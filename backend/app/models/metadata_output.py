"""
SQLAlchemy model for persisting full outputs from the School Profile & Metadata Agent.
Provides an immutable historical audit trail of extractions, DQA scores, and recommendations.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON

from app.core.database import Base


def _utc_now():
    return datetime.now(UTC)


class MetadataAgentOutputModel(Base):
    """
    Stores complete structured outcomes of the School Profile & Metadata Agent.
    """

    __tablename__ = "metadata_agent_outputs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(
        Uuid(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )
    staging_school_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("staging_schools.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    batch_id = Column(
        Uuid(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    job_id = Column(String(100), nullable=False, index=True)
    agent_version = Column(String(30), nullable=False, default="1.2.0")
    model_name = Column(String(100), nullable=False, default="gpt-6-luna")
    overall_score = Column(Integer, nullable=False, default=0)
    verification_status = Column(
        String(50), nullable=False, default="needs_review"
    )  # verified, needs_review, invalid
    extracted_fields = Column(JSONB().with_variant(JSON, "sqlite"), nullable=False, default=dict)
    recommendations = Column(JSONB().with_variant(JSON, "sqlite"), nullable=False, default=list)
    pages_crawled_count = Column(Integer, nullable=False, default=0)
    cache_hits_count = Column(Integer, nullable=False, default=0)
    applied_to_school = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=_utc_now)
