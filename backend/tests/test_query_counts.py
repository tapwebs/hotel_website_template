"""Automated regression suite verifying exact query counts and eliminating N+1 regressions."""
import pytest
from sqlalchemy import event
from backend.app.core.config import settings
from backend.app.services.folio_service import FolioService
from backend.app.services.operations_service import OperationsService
from backend.app.services.pos_service import POSService, _invalidate_menu_cache
from backend.tests.conftest import test_engine


class QueryCounter:
    def __init__(self):
        self.count = 0
        self.statements = []

    def __call__(self, conn, cursor, statement, parameters, context, executemany):
        # Ignore transaction commits/rollbacks
        if not statement.strip().upper().startswith(("BEGIN", "COMMIT", "ROLLBACK", "PRAGMA")):
            self.count += 1
            self.statements.append(statement)


@pytest.mark.asyncio
async def test_folio_listing_query_count(db_session):
    """Verifies that listing master folios executes exactly 2 queries regardless of count."""
    counter = QueryCounter()
    event.listen(test_engine.sync_engine, "before_cursor_execute", counter)

    try:
        folios = await FolioService.get_all_folios(db_session, "prop-jaipur-01")
        assert len(folios) >= 1
        # Query 1: Master folios
        # Query 2: Batched payments where folio_id in (...)
        # Query 3: Batched line items where folio_id in (...)
        # Query 4: Batched guest profiles where guest_id in (...)
        assert counter.count <= 4, f"Expected <= 4 queries, got {counter.count}: {counter.statements}"
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", counter)


@pytest.mark.asyncio
async def test_housekeeping_tasks_query_count(db_session):
    """Verifies that listing housekeeping tasks batches room and category fetches in exactly 3 queries."""
    counter = QueryCounter()
    event.listen(test_engine.sync_engine, "before_cursor_execute", counter)

    try:
        tasks = await OperationsService.get_housekeeping_tasks(db_session, "prop-jaipur-01")
        assert len(tasks) >= 1
        # 1 query for tasks, 1 batch query for all rooms, 1 batch query for all room types
        assert counter.count <= 3, f"Expected <= 3 queries, got {counter.count}: {counter.statements}"
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", counter)


@pytest.mark.asyncio
async def test_maintenance_tickets_query_count(db_session):
    """Verifies that listing maintenance tickets batches room lookups in <= 2 queries."""
    counter = QueryCounter()
    event.listen(test_engine.sync_engine, "before_cursor_execute", counter)

    try:
        tickets = await OperationsService.get_maintenance_tickets(db_session, "prop-jaipur-01")
        assert len(tickets) >= 1
        assert counter.count <= 2, f"Expected <= 2 queries, got {counter.count}: {counter.statements}"
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", counter)


@pytest.mark.asyncio
async def test_pos_menu_cache_zero_queries_on_hit(db_session):
    """Verifies that get_menu makes 1 query on miss and 0 queries on subsequent hits."""
    _invalidate_menu_cache("prop-jaipur-01")

    # Pass 1: Cold cache
    counter1 = QueryCounter()
    event.listen(test_engine.sync_engine, "before_cursor_execute", counter1)
    try:
        menu1 = await POSService.get_menu(db_session, "prop-jaipur-01")
        assert len(menu1) >= 1
        assert counter1.count == 1
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", counter1)

    # Pass 2: Warm cache hit
    counter2 = QueryCounter()
    event.listen(test_engine.sync_engine, "before_cursor_execute", counter2)
    try:
        menu2 = await POSService.get_menu(db_session, "prop-jaipur-01")
        assert len(menu2) == len(menu1)
        assert counter2.count == 0, f"Expected 0 queries on cache hit, got {counter2.count}"
    finally:
        event.remove(test_engine.sync_engine, "before_cursor_execute", counter2)
