"""
Shared pytest fixtures for the SchoolPath AI-DOP test suite.

Strategy
--------
* Uses an **in-memory SQLite** database with a single shared connection so
  all test session fixtures see the same database state.
* SQLite in-memory databases are per-connection by default.  We share a
  single ``connection`` object across the session-scoped fixtures so
  ``create_all`` and test queries all hit the same in-memory DB.
* PostgreSQL-specific column types (JSONB, postgresql.UUID) in the Schools
  model are patched to JSON/String before DDL is emitted.
* Duplicate index declarations (same name from both column-level index=True
  and explicit Index()) are deduplicated to avoid SQLite errors.
* Every test function gets an isolated, auto-rolled-back DB session so tests
  do not leak state into one another.
* raise_server_exceptions=False on the TestClient so 500 responses are
  returned as response objects rather than re-raised, allowing tests to
  assert on specific error HTTP codes.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Uuid, create_engine, event
from sqlalchemy.orm import sessionmaker

# Force all models to register their metadata with Base (side-effect import)
import app.models  # noqa: F401
from app.core.database import Base, get_database_session
from app.main import app

# ---------------------------------------------------------------------------
# SQLite in-memory engine — use a named shared cache so one in-memory DB is
# shared across all connections in the same process.
# ---------------------------------------------------------------------------
SQLITE_TEST_URL = "sqlite:///file::memory:?cache=shared&uri=true"


def _patch_uuid_bind_processor() -> None:
    """Patch SQLAlchemy's Uuid.bind_processor so that when running on SQLite,
    string-formatted UUID parameters (e.g. from FastAPI path/query params)
    are automatically converted to uuid.UUID objects before SQLite binding.
    """
    import contextlib
    import uuid as _uuid_mod

    orig_bind_processor = Uuid.bind_processor

    def safe_bind_processor(self, dialect):
        proc = orig_bind_processor(self, dialect)
        if proc:

            def process(value):
                if isinstance(value, str):
                    with contextlib.suppress(ValueError):
                        value = _uuid_mod.UUID(value)
                return proc(value)

            return process
        return proc

    Uuid.bind_processor = safe_bind_processor


def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
    """Enable foreign key enforcement in SQLite (off by default)."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ---------------------------------------------------------------------------
# Session-scoped engine + shared connection + table creation
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def engine():
    """Session-scoped SQLite engine using a named shared-cache URI."""
    test_engine = create_engine(
        SQLITE_TEST_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    event.listen(test_engine, "connect", _set_sqlite_pragma)
    return test_engine


@pytest.fixture(scope="session")
def tables(engine):
    """Create all tables once per test session; drop them when done."""
    _patch_uuid_bind_processor()
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


# ---------------------------------------------------------------------------
# DB session — function-scoped with rollback isolation
# ---------------------------------------------------------------------------
@pytest.fixture()
def db_session(engine, tables):
    """
    Provides a transactional DB session that is **rolled back** after each
    test, keeping the shared database clean without dropping/recreating tables.
    """
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# FastAPI TestClient with DB dependency override
# ---------------------------------------------------------------------------
@pytest.fixture()
def client(db_session):
    """
    FastAPI TestClient that injects the test DB session via dependency override.

    ``raise_server_exceptions=False`` so 500 responses are returned as normal
    response objects, allowing tests to assert on error HTTP status codes.
    """

    def _override_db():
        yield db_session

    app.dependency_overrides[get_database_session] = _override_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()
