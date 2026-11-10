import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from backend.app.core import ratelimit
from backend.app.core.config import settings

# In test suites, ensure lifespan demo seed doesn't attempt to connect to production/dev database
settings.ENABLE_DEMO_SEED = False
settings.APP_ENV = "test"
if not settings.HMS_INTEGRATION_API_KEY:
    settings.HMS_INTEGRATION_API_KEY = "test-only-ci-integration-key"

from backend.app.core.database import Base, get_db
from backend.app.main import app
from backend.app.seed.demo_seed import seed_demo_data

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

from sqlalchemy import event

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    future=True
)

@event.listens_for(test_engine.sync_engine, "connect")
def _attach_sqlite_schemas(dbapi_con, con_record):
    cur = dbapi_con.cursor()
    cur.execute("ATTACH DATABASE ':memory:' AS website")
    cur.close()

test_async_session = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)



@pytest_asyncio.fixture(scope="function")
async def db_session():
    # The database is rebuilt for every test, so anything cached in the process (restaurant settings, menu) must go too;
    # otherwise a test that changed GST or a dish leaks it into the next test that runs on the same worker.
    from backend.app.core import dependencies
    from backend.app.services import fnb_config, pos_service, room_service
    fnb_config.reset_cache()
    pos_service._invalidate_menu_cache()
    room_service.clear_categories_cache()
    # A cached user from a previous test (e.g. after logout bumped token_version) made fresh tokens 401 under xdist.
    dependencies._user_cache.clear()
    dependencies.evict_property_cache()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_async_session() as session:
        await seed_demo_data(session)
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    ratelimit.reset()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    ratelimit.reset()
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def auth_headers(client):
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "admin", "password": "password123"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Property-Id": settings.DEFAULT_PROPERTY_ID
    }
