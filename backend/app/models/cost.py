"""
SQLAlchemy domain model for OpenAI Cost and Token Usage Logging.
Interoperable with SQLite (dev) and PostgreSQL (production).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.core.database import Base


def _utc_now():
    return datetime.now(UTC)


class OpenAICostLogModel(Base):
    """Stores granular cost, token, and latency metrics for every OpenAI API invocation."""

    __tablename__ = "openai_cost_logs"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_name = Column(String(100), nullable=False, index=True)
    school_id = Column(String(100), nullable=True, index=True)
    batch_id = Column(String(100), nullable=True, index=True)
    task_name = Column(String(100), nullable=True)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=False, default=0.0)
    duration_ms = Column(Integer, nullable=False, default=0)
    logged_at = Column(DateTime, nullable=False, default=_utc_now, index=True)
