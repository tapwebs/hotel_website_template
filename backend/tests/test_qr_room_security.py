import pytest
import secrets
import uuid
from sqlalchemy import select
from backend.app.core.config import settings
from backend.app.models.base import generate_uuid
from backend.app.models.organization import Organization, Property
from backend.app.models.room import Room, RoomType
from backend.app.models.website import (
    QrLink,
    QrOrganization,
    QrPlacement,
)


@pytest.mark.asyncio
async def test_qr_room_security_comprehensive(client, auth_headers, db_session):
    """Automated security verification for Room QR tokens:
    1. Valid Room 102 token resolves only to Room 102.
    2. Valid Room 103 token resolves only to Room 103.
    3. Changing the URL token or parameters cannot switch rooms.
    4. Guessing sequential room numbers cannot resolve another room.
    5. Invalid tokens are rejected.
    6. Revoked tokens are rejected.
    7. Tokens belonging to another property cannot cross property boundaries.
    8. Direct API requests cannot bypass QR token validation.
    9. Existing authorized QR management operations (sync, add, rotate, revoke) still work.
    10. Existing guest services and landing-page workflows remain functional.
    """
    # 0. Setup QR Org
    org_slug = "hotel-dream-heavens-sec"
    org = QrOrganization(
        id=generate_uuid(),
        slug=org_slug,
        name="Hotel Dream Heavens Security Test",
        category="Hotel",
        qr_status="active",
        status="published",
        wifi_ssid="DreamHeavens_Guest",
        wifi_password="safe_password",
        wifi_visible=True,
    )
    db_session.add(org)

    # General public link
    link = QrLink(
        id=generate_uuid(),
        organization_id=org.id,
        title="Book a Stay",
        destination_url="http://localhost:5173/book",
        category="Connect",
        sort_order=0,
        status="active",
    )
    db_session.add(link)

    # Fetch rooms seeded by demo_seed
    rooms = (await db_session.execute(select(Room).order_by(Room.room_number))).scalars().all()
    room102 = next((r for r in rooms if r.room_number == "102"), None)
    room103 = next((r for r in rooms if r.room_number == "103"), None)
    assert room102 is not None, "Room 102 must exist in seed"
    assert room103 is not None, "Room 103 must exist in seed"

    # Generate secure unguessable tokens
    token_102 = f"rm-{secrets.token_hex(16)}"
    token_103 = f"rm-{secrets.token_hex(16)}"

    # Create placement for Room 102
    p_102 = QrPlacement(
        id=generate_uuid(),
        organization_id=org.id,
        code=token_102,
        label="Room 102",
        kind="room",
        status="active",
        room_id=room102.room_id,
    )
    db_session.add(p_102)

    # Create placement for Room 103
    p_103 = QrPlacement(
        id=generate_uuid(),
        organization_id=org.id,
        code=token_103,
        label="Room 103",
        kind="room",
        status="active",
        room_id=room103.room_id,
    )
    db_session.add(p_103)

    # Public standee placement (non-room)
    p_lobby = QrPlacement(
        id=generate_uuid(),
        organization_id=org.id,
        code="lobby",
        label="Lobby Standee",
        kind="lobby",
        status="active",
    )
    db_session.add(p_lobby)

    await db_session.commit()

    # -------------------------------------------------------------------------------------------------
    # 1. Valid Room 102 token resolves only to Room 102
    # -------------------------------------------------------------------------------------------------
    res_102 = await client.get(f"/hub/{org_slug}?p={token_102}")
    assert res_102.status_code == 200
    data_102 = res_102.json()
    assert data_102["placement"] is not None
    assert data_102["placement"]["code"] == token_102
    assert data_102["placement"]["label"] == "Room 102"
    assert data_102["placement"]["kind"] == "room"
    assert room102.qr_token in data_102["placement"]["order_url"]
    assert room103.qr_token not in data_102["placement"]["order_url"]

    # -------------------------------------------------------------------------------------------------
    # 2. Valid Room 103 token resolves only to Room 103
    # -------------------------------------------------------------------------------------------------
    res_103 = await client.get(f"/hub/{org_slug}?p={token_103}")
    assert res_103.status_code == 200
    data_103 = res_103.json()
    assert data_103["placement"] is not None
    assert data_103["placement"]["code"] == token_103
    assert data_103["placement"]["label"] == "Room 103"
    assert data_103["placement"]["kind"] == "room"
    assert room103.qr_token in data_103["placement"]["order_url"]
    assert room102.qr_token not in data_103["placement"]["order_url"]

    # -------------------------------------------------------------------------------------------------
    # 3. Changing the URL token or parameters cannot switch rooms
    # -------------------------------------------------------------------------------------------------
    tampered_token = token_102[:-4] + "ffff"
    res_tampered = await client.get(f"/hub/{org_slug}?p={tampered_token}")
    assert res_tampered.status_code == 200
    data_tampered = res_tampered.json()
    # Modifying the token yields no room authorization
    assert data_tampered.get("placement") is None

    # -------------------------------------------------------------------------------------------------
    # 4. Guessing sequential room numbers cannot resolve another room
    # -------------------------------------------------------------------------------------------------
    for guess in ["room102", "room103", "room104", "102", "103", "rm-102", "room_102"]:
        res_guess = await client.get(f"/hub/{org_slug}?p={guess}")
        assert res_guess.status_code == 200
        assert res_guess.json().get("placement") is None, f"Guessing '{guess}' must not resolve any room"

    # -------------------------------------------------------------------------------------------------
    # 5. Invalid tokens are rejected
    # -------------------------------------------------------------------------------------------------
    res_invalid = await client.get(f"/hub/{org_slug}?p=invalid_token_12345")
    assert res_invalid.status_code == 200
    assert res_invalid.json().get("placement") is None

    # -------------------------------------------------------------------------------------------------
    # 6. Revoked tokens are rejected
    # -------------------------------------------------------------------------------------------------
    # Revoke Room 102 placement via admin endpoint
    res_revoke = await client.post(
        f"/api/v1/website/qr-hub/admin/organizations/{org_slug}/placements/{p_102.id}/revoke",
        headers=auth_headers,
    )
    assert res_revoke.status_code == 200
    assert res_revoke.json()["placement"]["status"] == "disabled"

    # Now request with token_102: must be rejected!
    res_102_revoked = await client.get(f"/hub/{org_slug}?p={token_102}")
    assert res_102_revoked.status_code == 200
    assert res_102_revoked.json().get("placement") is None, "Revoked token must not resolve"

    # -------------------------------------------------------------------------------------------------
    # 7. Tokens belonging to another property cannot cross property boundaries
    # -------------------------------------------------------------------------------------------------
    # Create another property
    foreign_prop = Property(
        property_id="prop-foreign-99",
        org_id=settings.DEFAULT_ORG_ID,
        code="DH-FOREIGN",
        name="Foreign Property",
        address_line1="Foreign Street",
        city="Udaipur",
        state_code="RJ",
        postal_code="313001",
    )
    db_session.add(foreign_prop)

    # Room type for foreign property
    foreign_rt = RoomType(
        room_type_id=generate_uuid(),
        property_id=foreign_prop.property_id,
        code="FOREIGN_DLX",
        name="Foreign Deluxe",
        base_rate_minor=300000,
    )
    db_session.add(foreign_rt)

    # Room in foreign property
    foreign_room = Room(
        room_id=generate_uuid(),
        property_id=foreign_prop.property_id,
        room_type_id=foreign_rt.room_type_id,
        room_number="999",
        qr_token=generate_uuid(),
    )
    db_session.add(foreign_room)

    foreign_token = f"rm-{secrets.token_hex(16)}"
    p_foreign = QrPlacement(
        id=generate_uuid(),
        organization_id=org.id,
        code=foreign_token,
        label="Room 999",
        kind="room",
        status="active",
        room_id=foreign_room.room_id,  # Mapped to a room in a different property!
    )
    db_session.add(p_foreign)
    await db_session.commit()

    # Query with foreign token on this org: cross-property check must reject!
    res_foreign = await client.get(f"/hub/{org_slug}?p={foreign_token}")
    assert res_foreign.status_code == 200
    assert res_foreign.json().get("placement") is None, "Cross-property room placement must be blocked"

    # -------------------------------------------------------------------------------------------------
    # 8. Direct API requests cannot bypass QR token validation
    # -------------------------------------------------------------------------------------------------
    # Scan redirect /r/{slug} must drop invalid or revoked parameters
    res_redir_bad = await client.get(f"/r/{org_slug}?p={token_102}", follow_redirects=False)
    assert res_redir_bad.status_code == 302
    assert "?p=" not in res_redir_bad.headers["location"], "Invalid/revoked parameter must be stripped in redirect"

    res_redir_good = await client.get(f"/r/{org_slug}?p={token_103}", follow_redirects=False)
    assert res_redir_good.status_code == 302
    assert f"?p={token_103}" in res_redir_good.headers["location"]

    # -------------------------------------------------------------------------------------------------
    # 9. Existing authorized QR management operations (sync, add, rotate, revoke) still work
    # -------------------------------------------------------------------------------------------------
    # Sync room placements (creates secure tokens for any unmapped rooms)
    res_sync = await client.post(
        f"/api/v1/website/qr-hub/admin/organizations/{org_slug}/placements/rooms",
        headers=auth_headers,
    )
    assert res_sync.status_code == 200
    sync_data = res_sync.json()
    assert "created" in sync_data
    for created_p in sync_data["created"]:
        assert created_p["code"].startswith("rm-")
        assert len(created_p["code"]) == 35  # "rm-" + 32 hex chars

    # Rotate token for Room 103
    old_room103_qr = room103.qr_token
    res_rotate = await client.post(
        f"/api/v1/website/qr-hub/admin/organizations/{org_slug}/placements/{p_103.id}/rotate",
        headers=auth_headers,
    )
    assert res_rotate.status_code == 200
    new_token_103 = res_rotate.json()["placement"]["code"]
    assert new_token_103 != token_103
    assert new_token_103.startswith("rm-")

    # Old token 103 is now invalid
    res_old = await client.get(f"/hub/{org_slug}?p={token_103}")
    assert res_old.json().get("placement") is None

    # New rotated token works
    res_new = await client.get(f"/hub/{org_slug}?p={new_token_103}")
    assert res_new.json()["placement"]["label"] == "Room 103"
    assert res_new.json()["placement"]["order_url"] is not None

    # -------------------------------------------------------------------------------------------------
    # 10. Existing guest services and landing-page workflows remain functional
    # -------------------------------------------------------------------------------------------------
    # Non-room placements (e.g. lobby standee) work normally without room exposure
    res_lobby = await client.get(f"/hub/{org_slug}?p=lobby")
    assert res_lobby.status_code == 200
    data_lobby = res_lobby.json()
    assert data_lobby["placement"]["code"] == "lobby"
    assert data_lobby["placement"]["label"] == "Lobby Standee"
    assert data_lobby["placement"].get("order_url") is None
    assert len(data_lobby["links"]) >= 1
    assert data_lobby["wifi"]["ssid"] == "DreamHeavens_Guest"
