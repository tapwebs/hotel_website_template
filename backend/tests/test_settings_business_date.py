import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_settings_business_date_synchronization(client, auth_headers):
    """
    Test that Settings API always returns the authoritative business date
    and protects it from being overwritten by stale client settings payloads.
    """
    # 1. Ensure current business date is 2026-10-19
    init_res = await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )
    assert init_res.status_code == 200

    # 2. GET /settings should return top-level current_business_date AND synced settings.businessDate
    get_res = await client.get(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers
    )
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["current_business_date"] == "2026-10-19"
    assert "businessDate" in data["settings"], "settings should contain businessDate object"
    assert data["settings"]["businessDate"]["currentBusinessDate"] == "2026-10-19"

    # 3. PUT /settings with stale client date (e.g. 2026-09-29) MUST NOT overwrite authoritative date
    save_res = await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={
            "settings": {
                "propertyIdentity": {
                    "propertyName": "TapMenu Grand Resort & Spa"
                },
                "businessDate": {
                    "currentBusinessDate": "2026-09-29",
                    "lastNightAuditTimestamp": "2026-09-29 03:15:22 IST"
                }
            }
        }
    )
    assert save_res.status_code == 200
    save_data = save_res.json()
    # Authoritative date must STILL be 2026-10-19, not 2026-09-29!
    assert save_data["current_business_date"] == "2026-10-19"
    assert save_data["settings"]["businessDate"]["currentBusinessDate"] == "2026-10-19"

    # 4. Verify GET /settings also confirms date remained 2026-10-19
    verify_res = await client.get(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["current_business_date"] == "2026-10-19"
    assert verify_data["settings"]["businessDate"]["currentBusinessDate"] == "2026-10-19"

    # 5. Night audit rollover advances authoritative date to 2026-10-20
    rollover_res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers
    )
    assert rollover_res.status_code == 200
    assert rollover_res.json()["new_business_date"] == "2026-10-20"

    # Settings must now return 2026-10-20
    after_audit = await client.get(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers
    )
    assert after_audit.status_code == 200
    assert after_audit.json()["current_business_date"] == "2026-10-20"
    assert after_audit.json()["settings"]["businessDate"]["currentBusinessDate"] == "2026-10-20"

    # Reset back to 2026-10-19 for subsequent tests
    reset_res = await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )
    assert reset_res.status_code == 200
