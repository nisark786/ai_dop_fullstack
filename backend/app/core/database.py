from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# Configure database engine with safety limits
# For SQLite, check_same_thread is False to allow FastAPI multi-threading
# For PostgreSQL, enforce statement_timeout=5000 per DB Safety Rule 3
db_url = settings.normalized_database_url
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"options": "-c statement_timeout=5000"}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,  # Automatically detects disconnected DB connections
    echo=False,  # Set to True if SQL query logging is needed
)

# Session factory for creating database sessions
DatabaseSessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all SQLAlchemy ORM models
Base = declarative_base()


def get_database_session():
    """
    FastAPI dependency that yields a database session per request,
    ensuring rollback on exception and clean closure when the request finishes.
    """
    session = DatabaseSessionFactory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
