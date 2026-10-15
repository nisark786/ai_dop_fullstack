"""
SQLAlchemy domain models for Batch Management and Intake.
Interoperable with SQLite (dev) and PostgreSQL (production).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.types import JSON

from app.core.database import Base


def _utc_now():
    return datetime.now(UTC)


class BatchModel(Base):
    """Represents a named operational grouping of schools."""

    __tablename__ = "batches"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    source_type = Column(String(50), nullable=False, default="excel_upload")
    status = Column(String(50), nullable=False, default="ready", index=True)
    school_count = Column(Integer, nullable=False, default=0)
    created_by = Column(String(100), nullable=False, default="operator")
    created_at = Column(DateTime, nullable=False, default=_utc_now)
    updated_at = Column(DateTime, nullable=False, default=_utc_now, onupdate=_utc_now)
    deleted_at = Column(DateTime, nullable=True, index=True)


class BatchSchoolModel(Base):
    """Associates schools with batches (many-to-many operational membership)."""

    __tablename__ = "batch_schools"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(
        Uuid(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Use cross-dialect Uuid (SQLAlchemy 2.x) — works on both SQLite and PostgreSQL
    school_id = Column(
        Uuid(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(50), nullable=False, default="pending", index=True)
    metadata_json = Column(JSON, nullable=True)
    added_at = Column(DateTime, nullable=False, default=_utc_now)

    __table_args__ = (Index("ix_batch_schools_batch_school", "batch_id", "school_id", unique=True),)
