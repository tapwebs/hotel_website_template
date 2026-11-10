import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.app.core.config import settings

# Engine configuration based on dialect
database_url = settings.DATABASE_URL

connect_args = {}
if "sqlite" in database_url:
    connect_args["check_same_thread"] = False
    engine = create_async_engine(
        database_url,
        echo=False,
        future=True,
        connect_args=connect_args
    )
else:
    # PostgreSQL asyncpg
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if settings.DB_PGBOUNCER:
        connect_args["statement_cache_size"] = 0  # pgbouncer transaction pooling cannot keep prepared statements
    connect_args["timeout"] = 30.0
    connect_args["command_timeout"] = 30.0
    engine = create_async_engine(
        database_url,
        echo=False,
        future=True,
        pool_size=settings.POSTGRES_POOL_SIZE,
        max_overflow=settings.POSTGRES_MAX_OVERFLOW,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args=connect_args
    )

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
