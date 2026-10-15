"""AWS RDS Sandbox database connection client and engine lifecycle manager.

Enforces connection pooling, pre-ping liveness checks, and query safety timeouts.
"""

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.config import settings

logger = logging.getLogger(__name__)

_sandbox_engine: Engine | None = None


def get_sandbox_engine() -> Engine | None:
    """Return the shared SQLAlchemy engine for AWS RDS Sandbox database.

    Initializes lazily on first access with statement_timeout=5000 and connection pooling.
    """
    global _sandbox_engine

    if not settings.sandbox_enabled:
        return None

    db_url = settings.sandbox_database_url
    if not db_url:
        logger.warning("Sandbox sync is enabled, but sandbox_database_url could not be resolved.")
        return None

    if _sandbox_engine is None:
        try:
            _sandbox_engine = create_engine(
                db_url,
                pool_size=5,
                max_overflow=5,
                pool_pre_ping=True,
                pool_recycle=1800,
                connect_args={"options": "-c statement_timeout=5000"},
            )
            logger.info("Initialized connection pool for AWS RDS Sandbox database.")
        except Exception as e:
            logger.error("Failed to initialize AWS RDS Sandbox engine: %s", e)
            return None

    return _sandbox_engine


def check_sandbox_health() -> bool:
    """Perform a lightweight read-only connectivity check against the Sandbox database."""
    engine = get_sandbox_engine()
    if not engine:
        return False

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
        return True
    except Exception as e:
        logger.warning("AWS RDS Sandbox health check failed: %s", e)
        return False
