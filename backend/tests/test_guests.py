import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_get_guests(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/guests", headers=auth_headers)
    assert response.status_code == 200
    guests = response.json()
    assert len(guests) >= 3
    assert any(g["fullName"] == "Rahul Sharma" for g in guests)


@pytest.mark.asyncio
async def test_create_guest(client, auth_headers):
    response = await client.post(
        f"{settings.API_V1_PREFIX}/guests",
        headers=auth_headers,
        json={
            "first_name": "Vikram",
            "last_name": "Mehta",
            "email": "vikram.mehta@example.com",
            "phone": "+91 99000 11223",
            "nationality": "Indian",
            "vip_tier": "SILVER"
        }
    )
    assert response.status_code == 200
    guest = response.json()
    assert guest["fullName"] == "Vikram Mehta"
    assert guest["vipTier"] == "SILVER"


@pytest.mark.asyncio
async def test_search_guest(client, auth_headers):
    response = await client.get(
        f"{settings.API_V1_PREFIX}/guests?search=Rahul",
        headers=auth_headers
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) >= 1
    assert "Rahul" in results[0]["fullName"]
