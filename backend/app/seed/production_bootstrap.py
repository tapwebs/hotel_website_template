"""Production bootstrap: remove ALL demo data and create the real staff accounts.

Usage (run from the repo root, with the production DATABASE_URL in the environment):

    python -m backend.app.seed.production_bootstrap --users /secure/path/users.json            # dry run
    python -m backend.app.seed.production_bootstrap --users /secure/path/users.json --apply    # wipe + create

users.json is NOT stored in the repo (it holds passwords). Format:

    [{"email": "...", "password": "...", "full_name": "...", "kind": "superadmin|admin|captain"}, ...]

--apply DELETES EVERY ROW in every HMS table (alembic_version and the "website" schema are kept), then creates one
organization, one property and the listed users. Take a DB backup first.
"""
import argparse
import asyncio
import json
import sys

from sqlalchemy import delete, func, inspect, select

from backend.app.core.config import settings
from backend.app.core.database import Base, async_session_factory
from backend.app.core.rbac import get_role_permissions
from backend.app.core.security import hash_password
from backend.app.models.organization import Organization, Property, PropertySettings
from backend.app.models.user import User
from backend.app.seed.production_setup import PROPERTY_PROFILE, add_rooms
import backend.app.models  # noqa: F401  (register every table on Base.metadata)

ALL_SCOPES = ["RESTAURANT_POS", "ACCOUNTANT"]

# kind -> (role_code, account_type, job_role, management_scope)
KINDS = {
    "superadmin": ("ROLE_SUPER_ADMIN", "OWNER", None, ALL_SCOPES),
    "admin": ("ROLE_GENERAL_MANAGER", "MANAGER", None, ALL_SCOPES),
    "captain": ("ROLE_CAPTAIN", "STAFF", "CAPTAIN", []),
    "waiter": ("ROLE_WAITER", "STAFF", "WAITER", []),
    "kitchen": ("ROLE_KITCHEN_STAFF", "STAFF", "KITCHEN_STAFF", []),
    "accountant": ("ROLE_ACCOUNTANT", "STAFF", "ACCOUNTANT", []),
}


def load_users(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        users = json.load(f)
    seen = set()
    for u in users:
        if u.get("kind") not in KINDS:
            sys.exit(f"Invalid kind for {u.get('email')}: {u.get('kind')}")
        email = u["email"].strip().lower()
        if email in seen:
            sys.exit(f"Duplicate email {email}")
        seen.add(email)
        if len(u["password"]) < 8:
            sys.exit(f"Password too short for {email}")
    return users


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", required=True)
    ap.add_argument("--apply", action="store_true", help="actually wipe and create (default is dry run)")
    ap.add_argument("--rooms", action="append", default=[], help="CODE=101-110,201 (repeatable), see production_setup")
    args = ap.parse_args()
    users = load_users(args.users)

    # Tables in a separate DB schema (the public website's "website" schema: real guest sign-ups and
    # bookings) are left untouched.
    tables = [t for t in reversed(Base.metadata.sorted_tables) if t.name != "alembic_version" and t.schema is None]
    async with async_session_factory() as db:
        print(f"DATABASE: {settings.DATABASE_URL.split('@')[-1]}  APP_ENV={settings.APP_ENV}")
        # Models may define tables that were never migrated into this database; skip those.
        conn = await db.connection()
        existing = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))
        skipped = [t.name for t in tables if t.name not in existing]
        tables = [t for t in tables if t.name in existing]
        if skipped:
            print(f"  (not in database, skipped: {', '.join(skipped)})")
        for t in tables:
            n = (await db.execute(select(func.count()).select_from(t))).scalar_one()
            if n:
                print(f"  {t.name}: {n} rows")
        if not args.apply:
            print("Dry run only. Re-run with --apply to delete all rows above and create the accounts.")
            return

        for t in tables:
            await db.execute(delete(t))

        org = Organization(
            org_id=settings.DEFAULT_ORG_ID,
            name=PROPERTY_PROFILE["name"],
            legal_entity_name=PROPERTY_PROFILE["name"],
            is_active=True,
        )
        db.add(org)
        await db.flush()
        prop = Property(
            property_id=settings.DEFAULT_PROPERTY_ID,
            org_id=org.org_id,
            code=settings.DEFAULT_PROPERTY_CODE,
            currency="INR",
            timezone="Asia/Kolkata",
            **PROPERTY_PROFILE,
        )
        db.add(prop)
        await db.flush()
        db.add(PropertySettings(property_id=prop.property_id, settings_json={}))
        rooms_created = await add_rooms(db, prop.property_id, args.rooms)

        for u in users:
            role, acct, job, scope = KINDS[u["kind"]]
            email = u["email"].strip().lower()
            db.add(User(
                org_id=org.org_id,
                property_id=prop.property_id,
                username=email.split("@")[0],
                email=email,
                full_name=u.get("full_name") or email.split("@")[0],
                password_hash=hash_password(u["password"]),
                role_code=role,
                account_type=acct,
                job_role=job,
                permissions=sorted(get_role_permissions(role)),
                management_scope=scope,
                is_active=True,
                token_version=1,
            ))
        await db.commit()
        print(f"Done. Wiped {len(tables)} tables; created {len(users)} users, room types, rate plans and {rooms_created} rooms.")


if __name__ == "__main__":
    asyncio.run(main())
