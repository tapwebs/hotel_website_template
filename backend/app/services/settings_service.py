import re
from typing import Any, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.errors import ValidationException
from backend.app.models.organization import Organization, Property, PropertySettings
from backend.app.schemas.settings import SettingsResponse


from backend.app.core.timezone import get_kolkata_calendar_date

def get_default_business_date() -> str:
    return get_kolkata_calendar_date()


GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


async def _overlay_property(db: AsyncSession, property_id: str, merged: Dict[str, Any]) -> None:
    """The property record is the source of truth for identity and registration; invoices read it too."""
    prop = await db.get(Property, property_id)
    if not prop:
        return
    org = await db.get(Organization, prop.org_id)
    identity = dict(merged.get("propertyIdentity") or {})
    identity.update(propertyName=prop.name, propertyCode=prop.code)
    if org:
        identity["legalEntityName"] = org.legal_entity_name
    merged["propertyIdentity"] = identity
    legal = dict(merged.get("legalRegistration") or {})
    legal.update(
        gstin=prop.gstin or "",
        registeredAddress=prop.address_line1,
        city=prop.city,
        pinCode=prop.postal_code,
        stateCode=prop.state_code,
    )
    merged["legalRegistration"] = legal


async def _sync_property(db: AsyncSession, property_id: str, new_settings: Dict[str, Any]) -> None:
    """Write identity / registration edits made in Settings back to the property record."""
    prop = await db.get(Property, property_id)
    if not prop:
        return
    identity = new_settings.get("propertyIdentity") or {}
    legal = new_settings.get("legalRegistration") or {}
    gstin = str(legal.get("gstin") or "").strip().upper()
    if gstin and not GSTIN_RE.match(gstin):
        raise ValidationException("GSTIN must be 15 characters in the standard format, e.g. 08ABCDE1234F1Z5.")
    if "gstin" in legal:
        prop.gstin = gstin or None
    for key, attr in (("registeredAddress", "address_line1"), ("city", "city"), ("pinCode", "postal_code"), ("stateCode", "state_code")):
        val = str(legal.get(key) or "").strip()
        if val:
            setattr(prop, attr, val)
    name = str(identity.get("propertyName") or "").strip()
    if name:
        prop.name = name
    legal_name = str(identity.get("legalEntityName") or "").strip()
    if legal_name:
        org = await db.get(Organization, prop.org_id)
        if org:
            org.legal_entity_name = legal_name


class SettingsService:
    @staticmethod
    async def get_settings(db: AsyncSession, property_id: str) -> SettingsResponse:
        stmt = select(PropertySettings).where(PropertySettings.property_id == property_id)
        settings_obj = (await db.execute(stmt)).scalar_one_or_none()

        if not settings_obj:
            settings_obj = PropertySettings(
                property_id=property_id,
                current_business_date=get_default_business_date(),
                night_audit_status="IDLE",
                settings_json={}
            )
            db.add(settings_obj)
            await db.commit()
            await db.refresh(settings_obj)

        merged_settings = dict(settings_obj.settings_json or {})
        bd_info = dict(merged_settings.get("businessDate") or {})
        bd_info["currentBusinessDate"] = settings_obj.current_business_date
        merged_settings["businessDate"] = bd_info

        return SettingsResponse(
            property_id=property_id,
            current_business_date=settings_obj.current_business_date,
            night_audit_status=settings_obj.night_audit_status,
            settings=merged_settings
        )

    @staticmethod
    async def update_settings(db: AsyncSession, property_id: str, new_settings: Dict[str, Any]) -> SettingsResponse:
        stmt = select(PropertySettings).where(PropertySettings.property_id == property_id)
        settings_obj = (await db.execute(stmt)).scalar_one_or_none()

        explicit_b_date = new_settings.get("current_business_date")
        await _sync_property(db, property_id, new_settings)

        if not settings_obj:
            settings_obj = PropertySettings(
                property_id=property_id,
                current_business_date=str(explicit_b_date) if explicit_b_date else get_default_business_date(),
                night_audit_status="IDLE",
                settings_json=new_settings
            )
            db.add(settings_obj)
        else:
            if explicit_b_date:
                settings_obj.current_business_date = str(explicit_b_date)
            merged = dict(settings_obj.settings_json or {})
            merged.update(new_settings)
            bd_info = dict(merged.get("businessDate") or {})
            bd_info["currentBusinessDate"] = settings_obj.current_business_date
            merged["businessDate"] = bd_info
            settings_obj.settings_json = merged

        await db.commit()
        await db.refresh(settings_obj)

        from backend.app.services.report_service import clear_reports_cache
        clear_reports_cache()

        merged_settings = dict(settings_obj.settings_json or {})
        bd_info = dict(merged_settings.get("businessDate") or {})
        bd_info["currentBusinessDate"] = settings_obj.current_business_date
        merged_settings["businessDate"] = bd_info

        return SettingsResponse(
            property_id=property_id,
            current_business_date=settings_obj.current_business_date,
            night_audit_status=settings_obj.night_audit_status,
            settings=merged_settings
        )
