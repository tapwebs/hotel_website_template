"""Dashboard, flash report and night audit use real ledger data, current GST slabs, and never double-charge."""
import pytest
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.core.tax import room_gst_percent, room_tax_minor
from backend.app.models.folio import FolioLineItem, MasterFolio
from backend.app.services.report_service import ReportService, clear_reports_cache

API = settings.API_V1_PREFIX
PID = settings.DEFAULT_PROPERTY_ID


def test_room_gst_slabs_follow_the_2025_rates():
    assert room_gst_percent(150_000) == 5      # Rs 1,500 Deluxe
    assert room_gst_percent(230_000) == 5      # Rs 2,300 Super Deluxe
    assert room_gst_percent(750_000) == 5      # exactly Rs 7,500 is still 5%
    assert room_gst_percent(750_001) == 18
    assert room_tax_minor(230_000) == 11_500


@pytest.mark.asyncio
async def test_flash_report_and_dashboard_agree_and_add_up(client, auth_headers):
    clear_reports_cache()
    kpis = (await client.get(f"{API}/reports/dashboard-kpis", headers=auth_headers)).json()
    flash = (await client.get(f"{API}/reports/flash-report", headers=auth_headers)).json()

    rev = flash["revenueSummary"]
    assert rev["roomRevenuePaise"] == kpis["todaysRoomRevenuePaise"]
    assert rev["fnbRevenuePaise"] == kpis["todaysFnbRevenuePaise"]
    assert rev["grossRevenuePaise"] == (
        rev["roomRevenuePaise"] + rev["fnbRevenuePaise"] + rev["laundryRevenuePaise"] + rev["spaRevenuePaise"] + rev["otherRevenuePaise"]
    )
    assert rev["taxesCollectedPaise"] == sum(t["totalTaxPaise"] for t in flash["taxLiabilityBreakdown"])
    for t in flash["taxLiabilityBreakdown"]:
        assert t["cgstPaise"] + t["sgstPaise"] + t["igstPaise"] == t["totalTaxPaise"]

    s = flash["settlements"]
    assert s["totalCollectedPaise"] == s["cashPaise"] + s["upiPaise"] + s["cardPaise"] + s["bankTransferPaise"] + s["cityLedgerPaise"]
    assert flash["roomStats"]["totalRooms"] == kpis["totalRooms"]
    assert flash["roomStats"]["roomsSold"] <= max(kpis["totalRooms"], 0)
    # ADR is room revenue per room sold, not an invented number
    sold = flash["roomStats"]["roomsSold"]
    assert flash["financialMetrics"]["adrPaise"] == (rev["roomRevenuePaise"] // sold if sold else 0)


@pytest.mark.asyncio
async def test_night_audit_posts_gst_correctly_and_never_double_charges_prepaid_stays(client, auth_headers, db_session):
    target = "2026-10-10"
    await client.put(f"{API}/settings", headers=auth_headers, json={"settings": {"current_business_date": target}})

    # A walk-in books and pays 3 nights up front: the folio already holds the whole stay.
    walk = await client.post(f"{API}/front-desk/walk-in", headers=auth_headers, json={
        "guest_name": "Prepaid Guest", "guest_phone": "+91 98888 11111", "room_number": "105",
        "nights": 3, "deposit_payment_method": "UPI", "advance_amount_paise": 0,
    })
    assert walk.status_code == 200, walk.text
    folio_id = (await client.get(f"{API}/reservations/{walk.json()['booking_reference']}", headers=auth_headers)).json()["masterFolioId"]
    before = (await db_session.execute(select(MasterFolio).where(MasterFolio.folio_id == folio_id))).scalar_one().total_charges_minor

    plan = await ReportService.room_posting_plan(db_session, PID, target)
    prepaid = next(p for p in plan if p["room_number"] == "105")
    assert prepaid["post"] is False and prepaid["reason"] == "PREPAID"
    expected_posts = [p for p in plan if p["post"]]

    roll = await client.post(f"{API}/reports/night-audit/rollover", headers=auth_headers,
                             json={"business_date": target, "force_auto_no_show": True})
    assert roll.status_code == 200, roll.text
    data = roll.json()
    assert data["room_charges_posted"] == len(expected_posts)
    assert data["total_tax_minor"] == sum(room_tax_minor(p["rate_minor"]) for p in expected_posts)

    db_session.expire_all()
    after = (await db_session.execute(select(MasterFolio).where(MasterFolio.folio_id == folio_id))).scalar_one()
    assert after.total_charges_minor == before  # prepaid stay was not charged again
    audit_lines = (await db_session.execute(
        select(FolioLineItem).where(FolioLineItem.folio_id == folio_id, FolioLineItem.posted_by == "NIGHT_AUDIT")
    )).scalars().all()
    assert audit_lines == []

    # The archived flash report is for the CLOSED day, not the new empty one
    assert data["flash_report"]["businessDate"] == target
    history = (await client.get(f"{API}/reports/night-audit/history", headers=auth_headers)).json()
    assert history[0]["business_date"] == target and history[0]["has_report"] is True
    archived = (await client.get(f"{API}/reports/flash-report?business_date={target}", headers=auth_headers)).json()
    assert archived["businessDate"] == target
