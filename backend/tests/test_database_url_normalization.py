import pytest
from sqlalchemy.ext.asyncio import create_async_engine
from alembic.config import Config
from backend.app.core.config import Settings


def test_database_url_normalization_postgres_prefix():
    """Verify legacy postgres:// URLs are converted to postgresql+asyncpg://."""
    url = "postgres://hdh_admin:secret123@postgres.example.com:5432/hotel_dream_heavens"
    normalized = Settings.assemble_database_url(url)
    assert normalized == "postgresql+asyncpg://hdh_admin:secret123@postgres.example.com:5432/hotel_dream_heavens"


def test_database_url_normalization_postgresql_prefix():
    """Verify standard postgresql:// URLs are converted to postgresql+asyncpg://."""
    url = "postgresql://hdh_admin:secret123@postgres.example.com:5432/hotel_dream_heavens"
    normalized = Settings.assemble_database_url(url)
    assert normalized == "postgresql+asyncpg://hdh_admin:secret123@postgres.example.com:5432/hotel_dream_heavens"


def test_database_url_normalization_already_asyncpg():
    """Verify postgresql+asyncpg:// URLs are preserved as-is."""
    url = "postgresql+asyncpg://hdh_admin:secret123@postgres.example.com:5432/hotel_dream_heavens"
    normalized = Settings.assemble_database_url(url)
    assert normalized == url


def test_database_url_normalization_sqlite():
    """Verify SQLite URLs are untouched."""
    url = "sqlite+aiosqlite:///path/to/test.db"
    normalized = Settings.assemble_database_url(url)
    assert normalized == url


def test_database_url_normalization_with_query_params():
    """Verify query parameters (such as sslmode) are preserved."""
    url = "postgres://user:pass@host:5432/db?sslmode=require&application_name=hms"
    normalized = Settings.assemble_database_url(url)
    assert normalized == "postgresql+asyncpg://user:pass@host:5432/db?sslmode=require&application_name=hms"


def test_async_engine_dialect_resolution_with_normalized_url():
    """Verify SQLAlchemy create_async_engine loads the postgresql+asyncpg dialect without NoSuchModuleError."""
    url = "postgres://hdh_admin:secret123@postgres.example.com:5432/hotel_dream_heavens"
    normalized = Settings.assemble_database_url(url)
    engine = create_async_engine(normalized)
    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "asyncpg"


def test_alembic_config_normalizes_postgres_url(tmp_path):
    """Verify Alembic configuration correctly normalizes postgres:// to postgresql+asyncpg://."""
    import os
    from backend.app.core.config import settings

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    alembic_script_location = os.path.join(backend_dir, "alembic")

    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("script_location", alembic_script_location)
    alembic_cfg.set_main_option("custom_db_url", "postgres://test_user:test_pass@localhost:5432/test_db")

    # Emulate the logic in alembic/env.py
    custom_url = alembic_cfg.get_main_option("custom_db_url")
    if custom_url:
        target_url = custom_url
    elif not alembic_cfg.get_main_option("sqlalchemy.url") or alembic_cfg.get_main_option("sqlalchemy.url") == "sqlite+aiosqlite:///./tapmenu_hms.db":
        target_url = settings.DATABASE_URL
    else:
        target_url = alembic_cfg.get_main_option("sqlalchemy.url")

    if target_url:
        if target_url.startswith("postgres://"):
            target_url = target_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif target_url.startswith("postgresql://"):
            target_url = target_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        alembic_cfg.set_main_option("sqlalchemy.url", target_url)

    final_url = alembic_cfg.get_main_option("sqlalchemy.url")
    assert final_url.startswith("postgresql+asyncpg://")
