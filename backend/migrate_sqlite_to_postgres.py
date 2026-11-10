
import asyncio
import json
import shutil
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from sqlalchemy import (
    MetaData, Table, create_engine, select, func, text,
    Integer, Boolean, DateTime, Date, Time, Numeric, JSON, Uuid
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


SOURCE = Path(__file__).resolve().parents[1] / "tapmenu_hms.db"
BACKUP = SOURCE.with_name("tapmenu_hms.pre-migration.bak.db")


def convert_value(value, column_type):
    if value is None:
        return None

    if isinstance(column_type, (Uuid, PG_UUID)):
        return value if isinstance(value, UUID) else UUID(str(value))

    if isinstance(column_type, JSON):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (ValueError, TypeError):
                return value
        return value

    if isinstance(column_type, Boolean):
        return bool(value)

    if isinstance(column_type, DateTime) and isinstance(value, str):
        return datetime.fromisoformat(value)

    if isinstance(column_type, Date) and not isinstance(value, datetime):
        if isinstance(value, str):
            return date.fromisoformat(value)

    if isinstance(column_type, Time) and isinstance(value, str):
        return time.fromisoformat(value)

    if isinstance(column_type, Numeric) and not isinstance(value, Decimal):
        return Decimal(str(value))

    return value


async def main():
    if not SOURCE.is_file():
        raise RuntimeError(f"SQLite source not found: {SOURCE}")

    # Preserve the original database before migration.
    if not BACKUP.exists():
        shutil.copy2(SOURCE, BACKUP)
    print(f"SQLite backup: {BACKUP}")

    sqlite_engine = create_engine(f"sqlite:///{SOURCE.as_posix()}")
    source_meta = MetaData()
    source_meta.reflect(bind=sqlite_engine)

    target_engine = create_async_engine(settings.DATABASE_URL)

    try:
        with sqlite_engine.connect() as source_conn:
            async with target_engine.begin() as target_conn:
                target_meta = MetaData()
                await target_conn.run_sync(target_meta.reflect)

                # Only import into an empty destination.
                for table in target_meta.sorted_tables:
                    if table.name == "alembic_version":
                        continue

                    count = await target_conn.scalar(
                        select(func.count()).select_from(table)
                    )
                    if count:
                        raise RuntimeError(
                            f"STOP: {table.name} already has {count} rows. "
                            "No data was imported."
                        )

                source_names = set(source_meta.tables)
                imported = 0

                # SQLAlchemy sorts tables by foreign-key dependencies.
                for target_table in target_meta.sorted_tables:
                    name = target_table.name

                    if name == "alembic_version" or name not in source_names:
                        continue

                    source_table = source_meta.tables[name]
                    source_rows = source_conn.execute(
                        select(source_table)
                    ).mappings()

                    target_columns = {
                        column.name: column
                        for column in target_table.columns
                    }
                    common = [
                        column.name
                        for column in source_table.columns
                        if column.name in target_columns
                    ]

                    batch = []
                    table_count = 0

                    for row in source_rows:
                        record = {
                            column: convert_value(
                                row[column],
                                target_columns[column].type
                            )
                            for column in common
                        }
                        batch.append(record)

                        if len(batch) >= 250:
                            await target_conn.execute(
                                target_table.insert(), batch
                            )
                            table_count += len(batch)
                            batch.clear()

                    if batch:
                        await target_conn.execute(
                            target_table.insert(), batch
                        )
                        table_count += len(batch)

                    imported += table_count
                    print(f"{name}: imported {table_count} rows")

                # Synchronize serial/identity sequences after preserving IDs.
                for table in target_meta.sorted_tables:
                    if table.name == "alembic_version":
                        continue

                    if len(table.primary_key.columns) != 1:
                        continue

                    pk = next(iter(table.primary_key.columns))
                    if not isinstance(pk.type, Integer):
                        continue

                    max_id = await target_conn.scalar(
                        select(func.max(pk))
                    )

                    if max_id is None:
                        continue

                    sequence = await target_conn.scalar(
                        text(
                            "SELECT pg_get_serial_sequence(:table_name, "
                            ":column_name)"
                        ),
                        {
                            "table_name": f"public.{table.name}",
                            "column_name": pk.name,
                        },
                    )

                    if sequence:
                        await target_conn.execute(
                            text("SELECT setval(CAST(:seq AS regclass), "
                                 ":max_id, true)"),
                            {"seq": sequence, "max_id": max_id},
                        )

                print(f"\nTotal imported rows: {imported}")
                print("Import transaction completed; verifying counts...")

        # Verify destination row counts after the transaction commits.
        async with target_engine.connect() as conn:
            for table in target_meta.sorted_tables:
                if table.name == "alembic_version":
                    continue
                count = await conn.scalar(
                    select(func.count()).select_from(table)
                )
                print(f"VERIFIED {table.name}: {count} rows")

        print("\nMIGRATION SUCCESSFUL")

    finally:
        sqlite_engine.dispose()
        await target_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
