"""
SQLAlchemy model for Staging Schools (intake isolation layer).
Ensures raw or unverified batch intake records do not pollute the golden production `schools` table.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON

from app.core.database import Base


def _utc_now():
    return datetime.now(UTC)


class StagingSchoolModel(Base):
    """
    Represents an ingested school undergoing multi-agent crawling, audit,
    and human-in-the-loop verification before promotion to the production `schools` table.
    """

    __tablename__ = "staging_schools"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(
        Uuid(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional link to production school if this intake row matches/updates an existing production record
    production_school_id = Column(
        Uuid(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL"), nullable=True, index=True
    )

    name = Column(String(255), nullable=False, index=True)
    website = Column(Text, nullable=True)
    address = Column(Text, nullable=True)
    district = Column(String(255), nullable=True, index=True)
    state = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    type = Column(JSONB().with_variant(JSON, "sqlite"), nullable=True, default=list)
    grades = Column(JSONB().with_variant(JSON, "sqlite"), nullable=True, default=list)

    # Lifecycle status: pending, crawling, crawled, needs_verification, verified, published, rejected
    status = Column(String(50), nullable=False, default="pending", index=True)

    # Unparsed source row data from CSV/Excel
    source_data = Column(JSONB().with_variant(JSON, "sqlite"), nullable=True, default=dict)

    # Product crawl progress & scores: e.g. {"products": {"info": {"status": "verified", "score": 90}}}
    metadata_json = Column(JSONB().with_variant(JSON, "sqlite"), nullable=True, default=dict)

    created_at = Column(DateTime, nullable=False, default=_utc_now)
    updated_at = Column(DateTime, nullable=False, default=_utc_now, onupdate=_utc_now)
    deleted_at = Column(DateTime, nullable=True, index=True)

    __table_args__ = (
        Index("ix_staging_schools_batch_name", "batch_id", "name"),
        Index("ix_staging_schools_status", "status"),
    )
