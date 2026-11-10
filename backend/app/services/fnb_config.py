"""F&B settings (GST, manager PIN, receipt, sound, station assignments, rewards) and a per-property change counter.

Settings live in property_settings.settings_json["fnb"], so no extra table is needed. The manager PIN is stored hashed.
The change counter lets staff screens poll with If-None-Match and get a cheap 304 when nothing changed.
"""
import time
from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from backend.app.core.security import hash_password, verify_password
from backend.app.models.organization import PropertySettings
from backend.app.schemas.pos import FnbConfig, FnbConfigUpdate

DEFAULT_REWARDS = [
    {"id": "r1", "label": "10% OFF", "type": "percent", "value": 10, "probability": 30, "color": "#f59e0b", "emoji": "🎉"},
    {"id": "r2", "label": "₹50 OFF", "type": "flat", "value": 50, "probability": 20, "color": "#10b981", "emoji": "💸"},
    {"id": "r3", "label": "Free Dessert", "type": "free_item", "value": 0, "probability": 10, "color": "#ec4899", "emoji": "🍨"},
    {"id": "r4", "label": "15% OFF", "type": "percent", "value": 15, "probability": 10, "color": "#6366f1", "emoji": "🔥"},
    {"id": "r5", "label": "Better luck next time", "type": "none", "value": 0, "probability": 30, "color": "#64748b", "emoji": "🍀"},
]

# ── change counter (in-process only, NOT shared between workers): kept as a harmless no-op signal. HTTP caching
# (ETags, /pos/version) is derived from the database instead, so it stays correct with several workers.
_versions: Dict[str, int] = {}


def version(property_id: str) -> int:
    return _versions.setdefault(property_id, int(time.time() * 1000))


def bump(property_id: str) -> None:
    _versions[property_id] = version(property_id) + 1


# ── settings ────────────────────────────────────────────────────────────────
_cache: Dict[str, tuple] = {}
_TTL = 5.0  # per worker; a settings change (GST, acceptance mode) reaches other workers within this window


async def _row(db: AsyncSession, property_id: str) -> PropertySettings:
    row = (await db.execute(select(PropertySettings).where(PropertySettings.property_id == property_id))).scalar_one_or_none()
    if not row:
        row = PropertySettings(property_id=property_id, settings_json={})
        db.add(row)
        await db.flush()
    return row


async def raw(db: AsyncSession, property_id: str) -> Dict[str, Any]:
    hit = _cache.get(property_id)
    if hit and time.monotonic() - hit[0] < _TTL:
        return hit[1]
    row = (await db.execute(select(PropertySettings).where(PropertySettings.property_id == property_id))).scalar_one_or_none()
    data = dict(((row.settings_json or {}).get("fnb") or {})) if row else {}
    _cache[property_id] = (time.monotonic(), data)
    return data


async def get_config(db: AsyncSession, property_id: str) -> FnbConfig:
    d = await raw(db, property_id)
    fields = {k: v for k, v in d.items() if k in FnbConfig.model_fields and k != "hasManagerPin"}
    cfg = FnbConfig(**fields, hasManagerPin=bool(d.get("managerPinHash")))
    if not cfg.rewards:
        cfg.rewards = DEFAULT_REWARDS
    return cfg


async def gst_percent(db: AsyncSession, property_id: str) -> int:
    return (await get_config(db, property_id)).gstPercent


async def update_config(db: AsyncSession, property_id: str, patch: FnbConfigUpdate) -> FnbConfig:
    row = await _row(db, property_id)
    data = dict(row.settings_json or {})
    fnb = dict(data.get("fnb") or {})
    for k, v in patch.model_dump(exclude_unset=True).items():
        if v is None:
            continue
        if k == "managerPin":
            fnb["managerPinHash"] = hash_password(v)
        else:
            fnb[k] = v
    data["fnb"] = fnb
    row.settings_json = data
    flag_modified(row, "settings_json")
    await db.commit()
    _cache.pop(property_id, None)
    bump(property_id)
    return await get_config(db, property_id)


async def check_pin(db: AsyncSession, property_id: str, pin: str | None) -> bool:
    h = (await raw(db, property_id)).get("managerPinHash")
    return bool(h and pin and verify_password(pin, h))


def reset_cache() -> None:
    _cache.clear()
