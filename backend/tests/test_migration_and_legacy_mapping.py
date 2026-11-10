import os
import tempfile
import pytest
from sqlalchemy import create_engine, text
from alembic.config import Config
from alembic import command


def test_alembic_migration_upgrade_and_downgrade():
    """Migrations upgrade cleanly, downgrade, and re-upgrade legacy users into the six-role model."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        db_url = f"sqlite:///{db_path}"
        engine = create_engine(db_url)

        # Configure Alembic pointing to our test database
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
        alembic_script_location = os.path.join(backend_dir, "alembic")

        async_db_url = f"sqlite+aiosqlite:///{db_path}"
        alembic_cfg = Config(alembic_ini_path)
        alembic_cfg.set_main_option("script_location", alembic_script_location)
        alembic_cfg.set_main_option("custom_db_url", async_db_url)

        # Run migration upgrade to head (b1c2d3e4f5a6)
        command.upgrade(alembic_cfg, "head")

        # Verify columns exist on users table
        with engine.connect() as conn:
            columns_query = conn.execute(text("PRAGMA table_info(users)"))
            cols = [row[1] for row in columns_query.fetchall()]
            assert "account_type" in cols, "account_type column missing from users table"
            assert "job_role" in cols, "job_role column missing from users table"

            # Insert legacy records without account_type
            conn.execute(text(
                "INSERT INTO organizations (org_id, name, legal_entity_name, is_active, created_at) "
                "VALUES ('org-test', 'Test Org', 'Test Org Pvt Ltd', 1, '2026-10-23 12:00:00')"
            ))
            legacy_test_users = [
                ('u-1', 'leg_super', 'ROLE_SUPER_ADMIN'),
                ('u-2', 'leg_gm', 'ROLE_GENERAL_MANAGER'),
                ('u-3', 'leg_waiter', 'ROLE_RESTAURANT_POS'),
                ('u-4', 'leg_cashier', 'ROLE_POS_CASHIER'),
                ('u-5', 'leg_front_desk', 'ROLE_FRONT_DESK'),
                ('u-6', 'leg_reservations', 'ROLE_RESERVATIONS'),
                ('u-7', 'leg_night_auditor', 'ROLE_NIGHT_AUDITOR'),
                ('u-8', 'leg_kitchen', 'ROLE_KITCHEN_STAFF'),
                ('u-9', 'leg_housekeeping', 'ROLE_HOUSEKEEPING'),
                ('u-10', 'leg_maintenance', 'ROLE_MAINTENANCE'),
                ('u-11', 'leg_accountant', 'ROLE_ACCOUNTANT'),
                ('u-12', 'leg_channel_mgr', 'ROLE_CHANNEL_MANAGER'),
                ('u-13', 'leg_platform_admin', 'ROLE_PLATFORM_SUPER_ADMIN'),
            ]
            for uid, uname, rcode in legacy_test_users:
                conn.execute(text(
                    f"INSERT INTO users (user_id, org_id, username, email, full_name, password_hash, role_code, permissions, management_scope, is_active, token_version, created_at) "
                    f"VALUES ('{uid}', 'org-test', '{uname}', '{uname}@test.com', '{uname}', 'hash', '{rcode}', '[]', '[]', 1, 1, '2026-10-23 12:00:00')"
                ))
            conn.commit()

        # Run migration downgrade to down_revision
        command.downgrade(alembic_cfg, "a2b3c4d5e6f7")

        with engine.connect() as conn:
            columns_query = conn.execute(text("PRAGMA table_info(users)"))
            cols = [row[1] for row in columns_query.fetchall()]
            assert "account_type" not in cols, "account_type should be removed after downgrade"
            assert "job_role" not in cols, "job_role should be removed after downgrade"

        # Re-upgrade to head to test idempotency and backfill execution
        command.upgrade(alembic_cfg, "head")

        with engine.connect() as conn:
            res = conn.execute(text("SELECT username, account_type, job_role, role_code FROM users ORDER BY username")).fetchall()
            user_map = {row[0]: (row[1], row[2]) for row in res}
            roles = {row[0]: row[3] for row in res}
            # Six-role model (d4e5f6a7b8c9): retired roles become Waiter, accountants and kitchen staff keep their own job role.
            assert user_map["leg_super"] == ("OWNER", None)
            assert user_map["leg_gm"] == ("MANAGER", None)
            assert user_map["leg_platform_admin"] == ("PLATFORM_ADMIN", None)
            assert user_map["leg_accountant"] == ("STAFF", "ACCOUNTANT") and roles["leg_accountant"] == "ROLE_ACCOUNTANT"
            assert user_map["leg_kitchen"] == ("STAFF", "KITCHEN_STAFF") and roles["leg_kitchen"] == "ROLE_KITCHEN_STAFF"
            for retired in ("leg_waiter", "leg_cashier", "leg_front_desk", "leg_reservations", "leg_night_auditor",
                            "leg_housekeeping", "leg_maintenance", "leg_channel_mgr"):
                assert user_map[retired] == ("STAFF", "WAITER"), retired
                assert roles[retired] == "ROLE_WAITER", retired

    finally:
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass
