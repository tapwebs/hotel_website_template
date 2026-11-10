import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_get_room_categories(client):
    response = await client.get(
        f"{settings.API_V1_PREFIX}/availability/categories",
        headers={"X-Property-Id": settings.DEFAULT_PROPERTY_ID}
    )
    assert response.status_code == 200
    categories = response.json()
    assert len(categories) >= 3
    assert any(c["code"] == "DLX_PALACE" for c in categories)


@pytest.mark.asyncio
async def test_get_physical_rooms(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    assert response.status_code == 200
    rooms = response.json()
    assert len(rooms) >= 20
    assert any(r["roomNumber"] == "101" for r in rooms)


@pytest.mark.asyncio
async def test_update_room_status(client, auth_headers):
    # Find room 104
    get_res = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    rooms = get_res.json()
    room_104 = next(r for r in rooms if r["roomNumber"] == "104")

    # Update clean status to DIRTY
    patch_res = await client.patch(
        f"{settings.API_V1_PREFIX}/rooms/{room_104['id']}/status",
        headers=auth_headers,
        json={"clean_status": "DIRTY", "notes": "Guest checked out early"}
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["housekeepingStatus"] == "DIRTY"
    assert updated["notes"] == "Guest checked out early"


@pytest.mark.asyncio
async def test_room_housekeeping_persistence_and_synchronization(client, auth_headers):
    """
    Test 1: Database persistence
    Test 2: Cross-screen synchronization (Rooms & Rates -> Housekeeping -> Rooms & Rates)
    Test 3: Reverse synchronization & Failed inspection workflow
    """
    # 1. Fetch Room 101
    get_res = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    assert get_res.status_code == 200
    rooms = get_res.json()
    room_101 = next(r for r in rooms if r["roomNumber"] == "101")
    initial_occupancy = room_101["occupancyStatus"]

    # --- TEST 1: Database Persistence ---
    # Change Room 101 to DIRTY in Rooms & Rates
    patch_room = await client.patch(
        f"{settings.API_V1_PREFIX}/rooms/{room_101['id']}/status",
        headers=auth_headers,
        json={"clean_status": "DIRTY", "notes": "Turnover required"}
    )
    assert patch_room.status_code == 200
    assert patch_room.json()["housekeepingStatus"] == "DIRTY"

    # Reload Rooms & Rates (GET /rooms) and confirm status persists in database
    reload_rooms = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    room_101_reloaded = next(r for r in reload_rooms.json() if r["roomNumber"] == "101")
    assert room_101_reloaded["housekeepingStatus"] == "DIRTY"
    # Ensure physical occupancy status was strictly preserved
    assert room_101_reloaded["occupancyStatus"] == initial_occupancy

    # --- TEST 2: Cross-Screen Synchronization (Rooms & Rates -> Housekeeping) ---
    # Confirm Room 101 appears under Housekeeping tasks in Needs Cleaning (DIRTY)
    hk_tasks_res = await client.get(f"{settings.API_V1_PREFIX}/housekeeping/tasks", headers=auth_headers)
    assert hk_tasks_res.status_code == 200
    hk_tasks = hk_tasks_res.json()
    task_101 = next((t for t in hk_tasks if t["roomNumber"] == "101" and t["status"] == "DIRTY"), None)
    assert task_101 is not None, "Room 101 must appear in Housekeeping under Needs Cleaning (DIRTY)"

    # Change Room 101 to In Progress (CLEANING) in Housekeeping
    patch_task_cleaning = await client.patch(
        f"{settings.API_V1_PREFIX}/housekeeping/tasks/{task_101['id']}/status",
        headers=auth_headers,
        json={"status": "CLEANING", "assigned_to_staff_name": "Ramesh Kumar"}
    )
    assert patch_task_cleaning.status_code == 200
    assert patch_task_cleaning.json()["status"] == "CLEANING"

    # Confirm Rooms & Rates shows the same persisted status without restart
    reload_rooms_2 = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    room_101_v2 = next(r for r in reload_rooms_2.json() if r["roomNumber"] == "101")
    assert room_101_v2["housekeepingStatus"] == "CLEANING"
    assert room_101_v2["assignedHousekeeper"] == "Ramesh Kumar"

    # Advance to CLEANED in Housekeeping
    patch_task_cleaned = await client.patch(
        f"{settings.API_V1_PREFIX}/housekeeping/tasks/{task_101['id']}/status",
        headers=auth_headers,
        json={"status": "CLEANED"}
    )
    assert patch_task_cleaned.status_code == 200
    assert patch_task_cleaned.json()["status"] == "CLEANED"

    # Confirm Rooms & Rates shows CLEAN
    reload_rooms_3 = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    room_101_v3 = next(r for r in reload_rooms_3.json() if r["roomNumber"] == "101")
    assert room_101_v3["housekeepingStatus"] == "CLEAN"

    # --- TEST 3: Failed Inspection & Reverse Synchronization ---
    # Simulate a failed inspection returning Room 101 to DIRTY
    patch_task_failed = await client.patch(
        f"{settings.API_V1_PREFIX}/housekeeping/tasks/{task_101['id']}/status",
        headers=auth_headers,
        json={"status": "DIRTY", "notes": "Failed inspection: bathroom requires recleaning"}
    )
    assert patch_task_failed.status_code == 200
    assert patch_task_failed.json()["status"] == "DIRTY"

    # Verify Rooms & Rates reflects DIRTY
    reload_rooms_4 = await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)
    room_101_v4 = next(r for r in reload_rooms_4.json() if r["roomNumber"] == "101")
    assert room_101_v4["housekeepingStatus"] == "DIRTY"

    # Change from Rooms & Rates directly to INSPECTED
    patch_room_inspected = await client.patch(
        f"{settings.API_V1_PREFIX}/rooms/{room_101['id']}/status",
        headers=auth_headers,
        json={"clean_status": "INSPECTED"}
    )
    assert patch_room_inspected.status_code == 200
    assert patch_room_inspected.json()["housekeepingStatus"] == "INSPECTED"

    # Verify task in Housekeeping is now INSPECTED
    hk_tasks_res_final = await client.get(f"{settings.API_V1_PREFIX}/housekeeping/tasks", headers=auth_headers)
    task_101_final = next(t for t in hk_tasks_res_final.json() if t["id"] == task_101["id"])
    assert task_101_final["status"] == "INSPECTED"


@pytest.mark.asyncio
async def test_checkout_housekeeping_deduplication(client, auth_headers):
    """
    Test 4: Checkout turnover creation and deduplication protection
    """
    # 1. Create Hold and Confirm Booking
    hold_res = await client.post(
        f"{settings.API_V1_PREFIX}/availability/hold",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "categoryId": "cat-dlx-palace",
            "ratePlanId": "rp-dlx-cp",
            "checkIn": "2026-10-20",
            "checkOut": "2026-10-22",
            "adults": 1,
            "children": 0,
            "roomsCount": 1
        }
    )
    assert hold_res.status_code == 200
    hold = hold_res.json()

    confirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/confirm",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "holdId": hold["holdId"],
            "guest": {
                "title": "Mr",
                "firstName": "Turnover",
                "lastName": "Test",
                "email": "turnover@test.in",
                "phoneCountryCode": "+91",
                "phoneNumber": "+91 99999 88888",
                "agreeToTerms": True
            },
            "paymentMethod": "UPI"
        }
    )
    assert confirm_res.status_code == 200
    booking_ref = confirm_res.json()["bookingReference"]

    res_detail = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    res_id = res_detail["id"]

    # 2. Check-in to VACANT room 105
    checkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={
            "reservation_id": res_id,
            "room_id": "rm-105"
        }
    )
    assert checkin_res.status_code == 200
    stay_id = checkin_res.json()["stay_id"]

    # 3. Check-out of Room 105
    co_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": stay_id,
            "settle_remaining_with_method": "CASH"
        }
    )
    assert co_res.status_code == 200
    assert co_res.json()["success"] is True

    # Confirm room 105 is now VACANT and DIRTY
    room_105_after = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r_after = next(item for item in room_105_after if item["roomNumber"] == "105")
    assert r_after["occupancyStatus"] == "VACANT"
    assert r_after["housekeepingStatus"] == "DIRTY"

    # Verify exactly one active turnover task exists for room 105
    hk_tasks = (await client.get(f"{settings.API_V1_PREFIX}/housekeeping/tasks", headers=auth_headers)).json()
    active_tasks_105 = [t for t in hk_tasks if t["roomNumber"] == "105" and t["status"] in ["DIRTY", "CLEANING", "CLEANED"]]
    assert len(active_tasks_105) == 1
    assert active_tasks_105[0]["status"] == "DIRTY"
    assert active_tasks_105[0]["priority"] == "HIGH"

