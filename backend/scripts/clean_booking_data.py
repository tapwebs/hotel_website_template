"""Delete booking-related data only. Dry-run by default.

  BOOKING_CLEAN_DB_URL='postgresql://user:pass@host:5432/dbname' python backend/scripts/clean_booking_data.py            # dry run
  BOOKING_CLEAN_DB_URL=... python backend/scripts/clean_booking_data.py --execute                                       # real run

Before deleting, every affected table is exported to JSON (booking_backup_<timestamp>.json) next to the script.
Everything runs in ONE transaction: any error rolls back and nothing is deleted.
Kept: guests, rooms/types/rates, users, POS/menu/orders, audit logs, website users/QR config.
"""
import asyncio, datetime, json, os, sys
from urllib.parse import urlparse

import asyncpg

# Delete order matters for RESTRICT FKs (children first).
TABLES = [
    "payment_reconciliations", "invoices", "payments", "folio_line_items", "master_folios",
    "stays", "reservation_rooms", "reservations", "room_holds",
    "housekeeping_tasks", "website.bookings",
]


async def main(execute: bool):
    url = os.environ.get("BOOKING_CLEAN_DB_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not url:
        sys.exit("Set BOOKING_CLEAN_DB_URL")
    u = urlparse(url)
    print(f"Target: host={u.hostname} port={u.port} db={u.path.lstrip('/')}")
    con = await asyncpg.connect(url)
    try:
        counts = {t: await con.fetchval(f"SELECT count(*) FROM {t}") for t in TABLES}
        for t, c in counts.items():
            print(f"  {t:28} {c} rows")
        if not execute:
            print("\nDry run only. Re-run with --execute to delete.")
            return
        if input(f"\nType the database name '{u.path.lstrip('/')}' to confirm DELETE: ").strip() != u.path.lstrip("/"):
            sys.exit("Aborted.")

        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(os.path.dirname(__file__), f"booking_backup_{stamp}.json")
        backup = {t: [json.loads(r["j"]) for r in await con.fetch(f"SELECT row_to_json(x)::text AS j FROM {t} x")] for t in TABLES}
        backup["daily_inventory"] = [json.loads(r["j"]) for r in await con.fetch("SELECT row_to_json(x)::text AS j FROM daily_inventory x")]
        backup["rooms"] = [json.loads(r["j"]) for r in await con.fetch("SELECT row_to_json(x)::text AS j FROM rooms x")]
        with open(path, "w") as f:
            json.dump(backup, f, default=str)
        print(f"Backup written: {path}")

        async with con.transaction():
            for t in TABLES:
                await con.execute(f"DELETE FROM {t}")
            # Reset inventory counters; keep rows and totals/blocked rooms.
            await con.execute("""UPDATE daily_inventory SET reserved_rooms=0, occupied_rooms=0, held_rooms=0,
                                 available_rooms = GREATEST(total_rooms - ooo_rooms - oos_rooms, 0)""")
            # Rooms no longer have guests/stays (OUT_OF_ORDER/OUT_OF_SERVICE left as is).
            await con.execute("""UPDATE rooms SET current_stay_id=NULL, current_guest_name=NULL,
                                 occupancy_status='VACANT' WHERE occupancy_status='OCCUPIED'""")
        print("Done. Committed.")
    finally:
        await con.close()


asyncio.run(main("--execute" in sys.argv))
