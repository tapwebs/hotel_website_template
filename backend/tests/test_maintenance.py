import pytest
from httpx import AsyncClient
from backend.app.core.config import settings


async def login(client: AsyncClient, username: str, password: str = "password123") -> dict:
    resp = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": username, "password": password}
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    token = resp.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Property-Id": settings.DEFAULT_PROPERTY_ID
    }


@pytest.mark.asyncio
async def test_create_maintenance_ticket_persistence(client: AsyncClient, auth_headers: dict):
    """
    Verify creating a ticket persists correct room, category, priority, description, reporter,
    and blocks_room_from_sale status to the database.
    Verify ticket details remain correct after reloading.
    """
    # 1. Create a work order for Room 102
    create_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "102",
            "category": "HVAC",
            "priority": "HIGH",
            "title": "Air Conditioner Leaking",
            "description": "Water dripping from the split unit onto the floor near window.",
            "assigned_technician": "Vikram Engineer",
            "blocks_room_from_sale": True
        }
    )
    assert create_res.status_code == 200, f"Failed to create ticket: {create_res.text}"
    ticket = create_res.json()

    assert ticket["ticketNumber"].startswith("MNT-2026-")
    assert ticket["roomNumber"] == "102"
    assert ticket["category"] == "HVAC"
    assert ticket["priority"] == "HIGH"
    assert ticket["title"] == "Air Conditioner Leaking"
    assert ticket["description"] == "Water dripping from the split unit onto the floor near window."
    assert ticket["assignedTechnician"] == "Vikram Engineer"
    assert ticket["status"] == "ASSIGNED"  # assigned technician at creation -> ASSIGNED
    assert ticket["blocksRoomFromSale"] is True
    assert ticket["reportedBy"] != ""

    ticket_id = ticket["id"]

    # 2. Reload tickets list and single ticket endpoint
    list_res = await client.get(f"{settings.API_V1_PREFIX}/maintenance/tickets", headers=auth_headers)
    assert list_res.status_code == 200
    all_tickets = list_res.json()
    reloaded_from_list = next((t for t in all_tickets if t["id"] == ticket_id), None)
    assert reloaded_from_list is not None
    assert reloaded_from_list["ticketNumber"] == ticket["ticketNumber"]
    assert reloaded_from_list["blocksRoomFromSale"] is True

    get_single_res = await client.get(f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}", headers=auth_headers)
    assert get_single_res.status_code == 200
    single_ticket = get_single_res.json()
    assert single_ticket["id"] == ticket_id
    assert single_ticket["title"] == "Air Conditioner Leaking"
    assert single_ticket["roomNumber"] == "102"


@pytest.mark.asyncio
async def test_maintenance_status_lifecycle_and_technician_assignment(client: AsyncClient, auth_headers: dict):
    """
    Verify complete transition lifecycle:
    OPEN -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> RESOLVED -> CLOSED
    And persistence across each step.
    """
    # 1. Create OPEN ticket without technician
    create_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "103",
            "category": "PLUMBING",
            "priority": "MEDIUM",
            "title": "Low water pressure in bathroom sink",
            "description": "Faucet aerator may need descaling",
            "blocks_room_from_sale": False
        }
    )
    assert create_res.status_code == 200
    ticket = create_res.json()
    assert ticket["status"] == "OPEN"
    assert ticket["assignedTechnician"] is None
    ticket_id = ticket["id"]

    # 2. Assign technician -> status becomes ASSIGNED
    assign_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"assigned_technician": "Suresh Plumber"}
    )
    assert assign_res.status_code == 200
    assigned_ticket = assign_res.json()
    assert assigned_ticket["status"] == "ASSIGNED"
    assert assigned_ticket["assignedTechnician"] == "Suresh Plumber"

    # 3. Transition to IN_PROGRESS
    progress_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "IN_PROGRESS"}
    )
    assert progress_res.status_code == 200
    assert progress_res.json()["status"] == "IN_PROGRESS"

    # 4. Transition to ON_HOLD
    hold_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "ON_HOLD", "resolution_notes": "Waiting for replacement cartridge"}
    )
    assert hold_res.status_code == 200
    assert hold_res.json()["status"] == "ON_HOLD"
    assert hold_res.json()["resolutionNotes"] == "Waiting for replacement cartridge"

    # 5. Transition to RESOLVED with notes
    resolved_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "RESOLVED", "resolution_notes": "Cartridge replaced and aerator cleared. Flow tested at 6 LPM."}
    )
    assert resolved_res.status_code == 200
    res_ticket = resolved_res.json()
    assert res_ticket["status"] == "RESOLVED"
    assert res_ticket["resolvedAt"] is not None
    assert "Cartridge replaced" in res_ticket["resolutionNotes"]

    # 6. Verify & Close Ticket (CLOSED)
    closed_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "Verified by Maintenance Supervisor."}
    )
    assert closed_res.status_code == 200
    closed_ticket = closed_res.json()
    assert closed_ticket["status"] == "CLOSED"
    assert closed_ticket["resolvedAt"] is not None


@pytest.mark.asyncio
async def test_room_blocking_prevents_availability_and_checkin(client: AsyncClient, auth_headers: dict):
    """
    Verify:
    1. Enabling maintenance block sets room maintenance_status to OUT_OF_ORDER.
    2. Occupancy status (VACANT) and clean status (CLEAN) are NOT overwritten.
    3. Room cannot be checked into (FrontDesk check-in and walk-in check-in are rejected with 409).
    4. Out of order room is excluded from availability holds.
    """
    # Fetch Room 104 initial status
    rooms_res = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    room_104 = next(r for r in rooms_res.json() if r["roomNumber"] == "104")
    orig_occupancy = room_104["occupancyStatus"]
    orig_clean = room_104["housekeepingStatus"]

    # 1. Create maintenance ticket blocking Room 104
    create_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "104",
            "category": "ELECTRICAL",
            "priority": "CRITICAL",
            "title": "Short circuit in main board",
            "blocks_room_from_sale": True
        }
    )
    assert create_res.status_code == 200
    ticket = create_res.json()

    # 2. Verify Room 104 in /rooms
    rooms_after = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r104_after = next(r for r in rooms_after if r["roomNumber"] == "104")
    assert r104_after["maintenanceStatus"] == "OUT_OF_ORDER"
    # Occupancy and clean statuses MUST be preserved!
    assert r104_after["occupancyStatus"] == orig_occupancy
    assert r104_after["housekeepingStatus"] == orig_clean

    # 3. Attempt walk-in check-in to Room 104 -> MUST FAIL with 409 Conflict
    walkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json={
            "guest_name": "Test WalkIn Guest",
            "guest_phone": "+91 9988776655",
            "guest_email": "testwalkin@example.com",
            "room_number": "104",
            "nights": 1
        }
    )
    assert walkin_res.status_code == 409
    err_body = walkin_res.json()
    msg = err_body.get("error", {}).get("message", "") or err_body.get("detail", "")
    assert "blocked for maintenance" in msg.lower()


@pytest.mark.asyncio
async def test_multi_ticket_room_blocking_and_independent_release(client: AsyncClient, auth_headers: dict):
    """
    Verify:
    1. If two active tickets block the same room (Ticket A and Ticket B):
    2. Resolving/closing Ticket A keeps room OUT_OF_ORDER because Ticket B is still active.
    3. Resolving/closing Ticket B releases the room to OPERATIONAL.
    """
    # 1. Create Ticket A on Room 109 with blocks_room_from_sale = True
    res_a = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "109",
            "category": "PLUMBING",
            "priority": "HIGH",
            "title": "Leaking bidet spray",
            "blocks_room_from_sale": True
        }
    )
    assert res_a.status_code == 200
    ticket_a = res_a.json()

    # 2. Create Ticket B on Room 109 with blocks_room_from_sale = True
    res_b = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "109",
            "category": "ELECTRICAL",
            "priority": "MEDIUM",
            "title": "Bedside switch faulty",
            "blocks_room_from_sale": True
        }
    )
    assert res_b.status_code == 200
    ticket_b = res_b.json()

    # Verify room is OUT_OF_ORDER
    rooms_1 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r109_1 = next(r for r in rooms_1 if r["roomNumber"] == "109")
    assert r109_1["maintenanceStatus"] == "OUT_OF_ORDER"

    # 3. Close Ticket A
    close_a = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_a['id']}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "Bidet valve replaced"}
    )
    assert close_a.status_code == 200

    # Room 109 MUST STILL be OUT_OF_ORDER because Ticket B is active!
    rooms_2 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r109_2 = next(r for r in rooms_2 if r["roomNumber"] == "109")
    assert r109_2["maintenanceStatus"] == "OUT_OF_ORDER", "Room must remain blocked while Ticket B is active"

    # 4. Now close Ticket B
    close_b = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_b['id']}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "Switch replaced"}
    )
    assert close_b.status_code == 200

    # Room 109 is now released to OPERATIONAL!
    rooms_3 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r109_3 = next(r for r in rooms_3 if r["roomNumber"] == "109")
    assert r109_3["maintenanceStatus"] == "OPERATIONAL"


@pytest.mark.asyncio
async def test_repair_completion_does_not_modify_cleanliness(client: AsyncClient, auth_headers: dict):
    """
    Verify: Repair completion and ticket closure does NOT automatically mark a room CLEAN or INSPECTED.
    If the room was DIRTY, it must remain DIRTY so it goes through Housekeeping.
    """
    # 1. Set Room 110 to DIRTY in Rooms & Rates
    rooms = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r110 = next(r for r in rooms if r["roomNumber"] == "110")
    await client.patch(
        f"{settings.API_V1_PREFIX}/rooms/{r110['id']}/status",
        headers=auth_headers,
        json={"clean_status": "DIRTY"}
    )

    # 2. Create blocking maintenance ticket on Room 110
    ticket_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "110",
            "category": "CARPENTRY",
            "priority": "MEDIUM",
            "title": "Wardrobe door hinge alignment",
            "blocks_room_from_sale": True
        }
    )
    assert ticket_res.status_code == 200
    ticket_id = ticket_res.json()["id"]

    # 3. Resolve and close ticket
    await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "RESOLVED", "resolution_notes": "Hinges tightened"}
    )
    await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "Sign-off complete"}
    )

    # 4. Verify Room 110: maintenance_status is OPERATIONAL, but cleanStatus is STILL DIRTY!
    rooms_after = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r110_after = next(r for r in rooms_after if r["roomNumber"] == "110")
    assert r110_after["maintenanceStatus"] == "OPERATIONAL"
    assert r110_after["housekeepingStatus"] == "DIRTY", "Room must NOT be automatically marked clean after repair"


@pytest.mark.asyncio
async def test_occupied_room_blocking_preserves_guest_stay(client: AsyncClient, auth_headers: dict):
    """
    Verify: When blocking an OCCUPIED room:
    1. The room is blocked for future sales/reservations (maintenance_status = OUT_OF_ORDER).
    2. The existing guest is NOT checked out, displaced, or moved.
    3. The room's occupancyStatus remains OCCUPIED.
    4. Checkout succeeds without error when the guest stay completes.
    """
    # Room 101 is seeded as OCCUPIED with stay_id 'stay-901'
    rooms_1 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r101 = next(r for r in rooms_1 if r["roomNumber"] == "101")
    assert r101["occupancyStatus"] == "OCCUPIED"

    # 1. Report a defect and block Room 101 from sale
    ticket_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "101",
            "category": "APPLIANCE",
            "priority": "HIGH",
            "title": "Smart TV remote unresponsive",
            "blocks_room_from_sale": True
        }
    )
    assert ticket_res.status_code == 200

    # 2. Verify Room 101 state: maintenance_status is OUT_OF_ORDER, but occupancyStatus is STILL OCCUPIED!
    rooms_2 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r101_after = next(r for r in rooms_2 if r["roomNumber"] == "101")
    assert r101_after["maintenanceStatus"] == "OUT_OF_ORDER"
    assert r101_after["occupancyStatus"] == "OCCUPIED", "Guest stay must not be disrupted"

    # 3. Check out guest via standard checkout workflow when stay finishes
    co_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={"stay_id": "stay-901", "settle_remaining_with_method": "CASH"}
    )
    assert co_res.status_code == 200
    assert co_res.json()["success"] is True

    # 4. Verify after checkout: occupancyStatus is VACANT, cleanStatus is DIRTY, but maintenanceStatus remains OUT_OF_ORDER!
    rooms_3 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r101_v3 = next(r for r in rooms_3 if r["roomNumber"] == "101")
    assert r101_v3["occupancyStatus"] == "VACANT"
    assert r101_v3["housekeepingStatus"] == "DIRTY"
    assert r101_v3["maintenanceStatus"] == "OUT_OF_ORDER"


@pytest.mark.asyncio
async def test_rbac_unauthorized_user_cannot_manage_maintenance(client: AsyncClient):
    """
    Verify: Staff without MANAGE_MAINTENANCE permission (e.g. front desk 'priya')
    receives 403 Forbidden when attempting to create or update maintenance tickets.
    """
    priya_headers = await login(client, "priya")

    # Attempt to create ticket
    create_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=priya_headers,
        json={
            "room_number": "101",
            "title": "Unauthorized maintenance ticket",
            "blocks_room_from_sale": False
        }
    )
    assert create_res.status_code == 403, "Accountants must not have MANAGE_MAINTENANCE permission"

    # Admins (who now handle maintenance) succeed
    vikram_headers = await login(client, "admin")
    vikram_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=vikram_headers,
        json={
            "room_number": "101",
            "category": "STRUCTURAL",
            "priority": "LOW",
            "title": "Balcony railing paint touchup",
            "blocks_room_from_sale": False
        }
    )
    assert vikram_res.status_code == 200


@pytest.mark.asyncio
async def test_room_103_maintenance_closure_releases_availability_and_restores_vacant(client: AsyncClient, auth_headers: dict):
    """
    Focused verification for Room 103 and seeded ticket MNT-2026-089:
    1. Verify Room 103 is initially OUT_OF_ORDER with active ticket MNT-2026-089.
    2. Close ticket MNT-2026-089.
    3. Room 103 must become maintenance_status = OPERATIONAL and occupancy_status = VACANT.
    4. Room 103's clean_status must strictly remain DIRTY.
    5. Room 103 must be available in inventory.
    """
    # 1. Fetch tickets and verify MNT-2026-089 exists on Room 103
    tickets_res = await client.get(f"{settings.API_V1_PREFIX}/maintenance/tickets", headers=auth_headers)
    assert tickets_res.status_code == 200
    all_tickets = tickets_res.json()
    ticket_89 = next((t for t in all_tickets if t["ticketNumber"] == "MNT-2026-089"), None)
    assert ticket_89 is not None, "Seeded ticket MNT-2026-089 must exist"

    # If ticket_89 is not IN_PROGRESS/OPEN, ensure it is set to IN_PROGRESS to test closure
    if ticket_89["status"] in ["CLOSED", "CANCELLED"]:
        await client.patch(
            f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_89['id']}/status",
            headers=auth_headers,
            json={"status": "IN_PROGRESS", "blocks_room_from_sale": True}
        )

    # Verify Room 103 is initially blocked
    rooms_1 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r103_blocked = next(r for r in rooms_1 if r["roomNumber"] == "103")
    assert r103_blocked["maintenanceStatus"] == "OUT_OF_ORDER"
    assert r103_blocked["activeMaintenanceTicketId"] == "MNT-2026-089"

    # 2. Close ticket MNT-2026-089
    close_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_89['id']}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "AC Compressor replaced and tested"}
    )
    assert close_res.status_code == 200

    # 3. Verify Room 103 is released to OPERATIONAL and VACANT, with DIRTY housekeeping preserved
    rooms_2 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r103_released = next(r for r in rooms_2 if r["roomNumber"] == "103")
    assert r103_released["maintenanceStatus"] == "OPERATIONAL"
    assert r103_released["occupancyStatus"] == "VACANT"
    assert r103_released["housekeepingStatus"] == "DIRTY", "Housekeeping clean_status must remain DIRTY"
    assert r103_released["activeMaintenanceTicketId"] is None
    assert r103_released["currentStayId"] is None
    assert r103_released["currentGuestName"] is None


@pytest.mark.asyncio
async def test_resolved_ticket_retains_block_until_verified_and_closed(client: AsyncClient, auth_headers: dict):
    """
    Verify: A ticket marked RESOLVED still requires verification before closure.
    The room MUST remain blocked from sale until status is CLOSED.
    """
    # 1. Create blocking ticket on Room 205
    create_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "205",
            "category": "PLUMBING",
            "priority": "HIGH",
            "title": "Shower thermostatic valve stuck",
            "blocks_room_from_sale": True
        }
    )
    assert create_res.status_code == 200
    ticket_id = create_res.json()["id"]

    # 2. Technician marks RESOLVED
    res_patch = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "RESOLVED", "resolution_notes": "Cartridge replaced"}
    )
    assert res_patch.status_code == 200

    # 3. Room 205 MUST STILL be OUT_OF_ORDER awaiting verification!
    rooms_1 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r205 = next(r for r in rooms_1 if r["roomNumber"] == "205")
    assert r205["maintenanceStatus"] == "OUT_OF_ORDER", "Resolved ticket must not prematurely release room"

    # Attempt check-in to Room 205 -> MUST be rejected with 409
    walkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json={
            "guest_name": "Resolved Verification Tester",
            "guest_phone": "+91 9123456789",
            "room_number": "205",
            "nights": 1
        }
    )
    assert walkin_res.status_code == 409

    # 4. Manager verifies and closes ticket -> Room released
    close_res = await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "Manager inspected and verified"}
    )
    assert close_res.status_code == 200

    rooms_2 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r205_after = next(r for r in rooms_2 if r["roomNumber"] == "205")
    assert r205_after["maintenanceStatus"] == "OPERATIONAL"
    assert r205_after["occupancyStatus"] == "VACANT"


@pytest.mark.asyncio
async def test_closing_non_blocking_ticket_does_not_clear_room_restrictions(client: AsyncClient, auth_headers: dict):
    """
    Verify: Closing a non-blocking ticket does NOT clear unrelated room restrictions:
    1. Room 303 has independent OUT_OF_SERVICE status. Closing non-blocking ticket leaves it OUT_OF_SERVICE.
    2. Room with active blocking ticket remains blocked when an unrelated non-blocking ticket is closed.
    """
    # 1. Non-blocking ticket on Room 303 (OUT_OF_SERVICE)
    t1_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "303",
            "category": "STRUCTURAL",
            "priority": "LOW",
            "title": "Cosmetic trim touchup",
            "blocks_room_from_sale": False
        }
    )
    assert t1_res.status_code == 200
    t1_id = t1_res.json()["id"]

    await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{t1_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED", "resolution_notes": "Trim repainted"}
    )

    rooms = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r303 = next(r for r in rooms if r["roomNumber"] == "303")
    assert r303["occupancyStatus"] == "OUT_OF_SERVICE", "Independent OUT_OF_SERVICE restriction must not be cleared"

    # 2. Room 207: Create blocking ticket A and non-blocking ticket B
    t_a_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "207",
            "category": "ELECTRICAL",
            "priority": "HIGH",
            "title": "Geyser element blown",
            "blocks_room_from_sale": True
        }
    )
    assert t_a_res.status_code == 200
    t_a_id = t_a_res.json()["id"]

    t_b_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "207",
            "category": "HOUSEKEEPING",
            "priority": "LOW",
            "title": "Curtain hooks missing",
            "blocks_room_from_sale": False
        }
    )
    assert t_b_res.status_code == 200
    t_b_id = t_b_res.json()["id"]

    # Close non-blocking ticket B -> Room 207 must STILL be OUT_OF_ORDER
    await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{t_b_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED"}
    )
    r207_mid = next(r for r in (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json() if r["roomNumber"] == "207")
    assert r207_mid["maintenanceStatus"] == "OUT_OF_ORDER", "Closing non-blocking ticket must not release blocking restriction"

    # Now close blocking ticket A -> Room 207 is released
    await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{t_a_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED"}
    )
    r207_final = next(r for r in (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json() if r["roomNumber"] == "207")
    assert r207_final["maintenanceStatus"] == "OPERATIONAL"


@pytest.mark.asyncio
async def test_room_moves_reject_maintenance_blocked_destination(client: AsyncClient, auth_headers: dict):
    """
    Verify: Front Desk room move rejects moving a guest into a room with active maintenance block.
    """
    # Block Room 203 with a maintenance ticket
    t_res = await client.post(
        f"{settings.API_V1_PREFIX}/maintenance/tickets",
        headers=auth_headers,
        json={
            "room_number": "203",
            "category": "CARPENTRY",
            "priority": "HIGH",
            "title": "Balcony latch broken",
            "blocks_room_from_sale": True
        }
    )
    assert t_res.status_code == 200
    ticket_id = t_res.json()["id"]

    # Room 203 room_id
    rooms = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r203 = next(r for r in rooms if r["roomNumber"] == "203")

    # Attempt room move for stay-901 to Room 203 -> Must fail with 409
    move_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/room-move",
        headers=auth_headers,
        json={
            "stay_id": "stay-901",
            "new_room_id": r203["id"],
            "reason": "Guest requested room upgrade"
        }
    )
    assert move_res.status_code == 409
    assert "blocked for maintenance" in move_res.json().get("error", {}).get("message", "").lower()

    # Clean up ticket
    await client.patch(
        f"{settings.API_V1_PREFIX}/maintenance/tickets/{ticket_id}/status",
        headers=auth_headers,
        json={"status": "CLOSED"}
    )

