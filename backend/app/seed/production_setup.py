"""Idempotent production setup: property profile, room types, rate plans and physical rooms.

Safe to run repeatedly and on a live database; it never deletes anything.

    python -m backend.app.seed.production_setup --rooms DLX_PALACE=101-110,201-210 --rooms ROYAL_SUITE=301-308

Room spec: CODE=ranges where CODE is a room type code and ranges is a comma list of numbers or
inclusive ranges (101-110,201). The floor is taken from the number (101 -> floor 1, 1203 -> floor 12).

Room type codes must match WEBSITE_ROOM_MAP so website bookings land in the right type:
    DLX_PALACE  = website "deluxe"        (Deluxe Room, Rs 2,000)
    ROYAL_SUITE = website "super-deluxe"  (Super Deluxe Room, Rs 2,200)
"""
import argparse
import asyncio
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import async_session_factory
from backend.app.models.organization import Organization, Property
from backend.app.models.room import RatePlan, Room, RoomType
import backend.app.models  # noqa: F401

# Generic demonstration property profile for initial setup.
PROPERTY_PROFILE = {
    "name": "TapMenu Grand Resort & Spa",
    "address_line1": "100 Hospitality Boulevard",
    "city": "Metropolis",
    "state_code": "08",
    "postal_code": "302001",
    "country_code": "IN",
    "phone": "+91 98765 43210",
    "email": "contact@example.com",
}

# Amenities and bed types as published on the website (every room has all of these).
_IN_ROOM = ["Air conditioning", "Wi-Fi", "TV", "Attached washroom", "Balcony", "Geyser", "Windows with curtains", "Extra pillows"]
ROOM_TYPES = [
    {"code": "DLX_PALACE", "name": "Deluxe Room", "rate_minor": 200_000, "tagline": "Comfortable double room", "bed_type": "King-size bed"},
    {"code": "ROYAL_SUITE", "name": "Super Deluxe Room", "rate_minor": 220_000, "tagline": "Spacious double room", "bed_type": "Bed larger than king-size"},
]


def parse_ranges(text: str) -> List[str]:
    out: List[str] = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.extend(str(n) for n in range(int(lo), int(hi) + 1))
        else:
            out.append(str(int(part)))
    return out


def floor_of(room_number: str) -> int:
    return int(room_number[:-2]) if len(room_number) >= 3 else 0


async def ensure_property_profile(db: AsyncSession, property_id: str) -> None:
    prop = await db.get(Property, property_id)
    if not prop:
        return
    for k, v in PROPERTY_PROFILE.items():
        setattr(prop, k, v)
    org = await db.get(Organization, prop.org_id)
    if org:
        org.name = PROPERTY_PROFILE["name"]
        org.legal_entity_name = org.legal_entity_name or PROPERTY_PROFILE["name"]


async def ensure_room_types(db: AsyncSession, property_id: str) -> Dict[str, RoomType]:
    types: Dict[str, RoomType] = {}
    for spec in ROOM_TYPES:
        rt = (await db.execute(select(RoomType).where(RoomType.property_id == property_id, RoomType.code == spec["code"]))).scalar_one_or_none()
        if not rt:
            rt = RoomType(
                property_id=property_id, code=spec["code"], name=spec["name"], tagline=spec["tagline"],
                bed_type=spec["bed_type"], amenities=[{"id": f"am-{i}", "name": n} for i, n in enumerate(_IN_ROOM, 1)],
                base_adults=2, max_adults=2, max_children=1, max_occupancy=3,
                base_rate_minor=spec["rate_minor"], is_active=True,
            )
            db.add(rt)
            await db.flush()
        types[spec["code"]] = rt
        has_plan = (await db.execute(select(RatePlan.rate_plan_id).where(RatePlan.room_type_id == rt.room_type_id))).first()
        if not has_plan:
            db.add(RatePlan(
                property_id=property_id, room_type_id=rt.room_type_id, code="BAR", name="Room Only",
                description="Best available rate, room only", meal_plan="ROOM_ONLY",
                base_price_minor=rt.base_rate_minor, is_active=True,
            ))
    await db.flush()
    return types


async def add_rooms(db: AsyncSession, property_id: str, specs: List[str]) -> int:
    types = await ensure_room_types(db, property_id)
    created = 0
    for spec in specs:
        code, _, ranges = spec.partition("=")
        rt = types.get(code.strip())
        if not rt:
            raise SystemExit(f"Unknown room type code {code!r}. Use one of: {', '.join(types)}")
        for number in parse_ranges(ranges):
            exists = (await db.execute(select(Room.room_id).where(Room.property_id == property_id, Room.room_number == number))).first()
            if exists:
                continue
            db.add(Room(
                property_id=property_id, room_type_id=rt.room_type_id, room_number=number,
                floor_number=floor_of(number), clean_status="CLEAN", occupancy_status="VACANT",
                maintenance_status="OPERATIONAL",
            ))
            created += 1
    return created


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rooms", action="append", default=[], help="CODE=101-110,201 (repeatable)")
    ap.add_argument("--property-id", default=settings.DEFAULT_PROPERTY_ID)
    args = ap.parse_args()
    async with async_session_factory() as db:
        await ensure_property_profile(db, args.property_id)
        created = await add_rooms(db, args.property_id, args.rooms)
        await db.commit()
        total = len((await db.execute(select(Room.room_id).where(Room.property_id == args.property_id))).all())
    print(f"Property profile, room types and rate plans are in place. Rooms added: {created}. Total rooms: {total}.")


if __name__ == "__main__":
    asyncio.run(main())
