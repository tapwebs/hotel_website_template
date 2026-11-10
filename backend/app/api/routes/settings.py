from typing import Optional
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_permission
from backend.app.core.rbac import Permission
from backend.app.models.user import User
from backend.app.schemas.settings import SettingsPayload, SettingsResponse
from backend.app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["Property Settings Configuration"])


@router.get("", response_model=SettingsResponse, summary="Get Hotel Settings")
async def get_settings(
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_SETTINGS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await SettingsService.get_settings(db, property_id)


@router.get("/public/branding", summary="Public branding (favicon) for the HMS and guest pages; no login needed")
async def public_branding(response: Response, property_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Only the browser icon and hotel name: nothing private, so guest pages and the login screen can use it."""
    response.headers["Cache-Control"] = "public, max-age=60"  # icon + name only; a change shows within a minute
    from sqlalchemy import select
    from backend.app.core.config import settings as app_settings
    from backend.app.models.organization import PropertySettings
    pid = property_id or app_settings.DEFAULT_PROPERTY_ID
    row = (await db.execute(select(PropertySettings).where(PropertySettings.property_id == pid))).scalar_one_or_none()
    data = (row.settings_json or {}) if row else {}
    favicon = str(((data.get("branding") or {}).get("faviconUrl")) or "")
    # Only same-site paths or https links; anything else is ignored.
    if favicon and not (favicon.startswith("/") and not favicon.startswith("//") or favicon.startswith("https://")):
        favicon = ""
    return {"faviconUrl": favicon, "propertyName": str(((data.get("propertyIdentity") or {}).get("propertyName")) or "")}


@router.put("", response_model=SettingsResponse, summary="Update Hotel Settings")
async def update_settings(
    payload: SettingsPayload,
    property_id: str = Depends(get_property_context),
    current_user: User = Depends(require_permission(Permission.MANAGE_SETTINGS.value)),
    db: AsyncSession = Depends(get_db)
):
    return await SettingsService.update_settings(db, property_id, payload.settings)
