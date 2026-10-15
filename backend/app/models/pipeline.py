"""
SQLAlchemy models for internal data pipeline execution, jobs, evidence, and audit logs.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)

from app.core.database import Base


class DataProductModel(Base):
    """
    SQLAlchemy ORM Model for Data Products (Spec Section 5.3).
    Stores dataset definitions and metadata versions.
    """

    __tablename__ = "data_products"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    target_table = Column(String(100), nullable=False, default="schools")
    schema_definition = Column(JSON, nullable=False)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )


class CrawlJobModel(Base):
    """
    SQLAlchemy ORM Model for Crawl Jobs (Spec Section 5.4).
    Tracks job statuses: pending, running, completed, failed.
    """

    __tablename__ = "crawl_jobs"

    id = Column(String(50), primary_key=True, index=True)
    school_id = Column(String(50), nullable=False, index=True)
    agent_name = Column(String(100), nullable=True)
    product_name = Column(String(100), nullable=True)
    status = Column(String(50), default="pending", index=True)
    current_step = Column(String(100), default="init")
    pages_crawled = Column(Integer, default=0)
    evidence_count = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    completed_at = Column(DateTime, nullable=True)


class EvidenceRecordModel(Base):
    """
    SQLAlchemy ORM Model for Evidence Records (Spec Section 5.5).
    Stores raw evidence fragments, source citations, timestamps, and confidence scores.
    """

    __tablename__ = "evidence_records"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(50), ForeignKey("crawl_jobs.id"), nullable=False, index=True)
    school_id = Column(
        Uuid(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )
    staging_school_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("staging_schools.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    metadata_output_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("metadata_agent_outputs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    field_name = Column(String(100), nullable=False, index=True)
    raw_value = Column(Text, nullable=True)
    source_url = Column(String(1000), nullable=False)
    source_name = Column(String(255), nullable=True)
    source_tier = Column(String(50), nullable=False, default="Tier 1 - Official School Website")
    source_type = Column(String(50), nullable=False, default="Official Portal")
    raw_extracted_text = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=False, default=1.0)
    extracted_at = Column(DateTime, default=lambda: datetime.now(UTC))


class ResolvedValueModel(Base):
    """
    SQLAlchemy ORM Model for Resolved Field Values (Spec Section 5.6).
    Stores final resolved values resulting from the multi-agent consensus.
    """

    __tablename__ = "resolved_values"

    id = Column(String(50), primary_key=True, index=True)
    job_id = Column(String(50), ForeignKey("crawl_jobs.id"), nullable=False, index=True)
    school_id = Column(String(50), nullable=False, index=True)
    field_name = Column(String(100), nullable=False, index=True)
    chosen_value = Column(Text, nullable=True)
    consensus_score = Column(Float, nullable=False)
    resolution_method = Column(String(50), default="consensus")
    conflict_detected = Column(Boolean, nullable=False, default=False)
    review_status = Column(String(50), nullable=False, default="pending", index=True)
    evidence_ids = Column(JSON, nullable=True)
    resolved_at = Column(DateTime, default=lambda: datetime.now(UTC))


class SourceRegistryModel(Base):
    """
    SQLAlchemy ORM Model for Source Authority Registry (Spec Section 5.7).
    Defines trust levels, tiers, and base weights for scraping sources.
    """

    __tablename__ = "source_registries"

    id = Column(String(50), primary_key=True, index=True)
    source_name = Column(String(100), nullable=False, default="Official Portal")
    domain_pattern = Column(String(255), unique=True, nullable=False, index=True)
    domain = Column(String(255), nullable=True, index=True)
    category = Column(String(50), nullable=False, default="Category 1 — Official School")
    source_tier = Column(String(50), nullable=True, default="Tier 1 - Official School Website")
    configured_weight = Column(Float, nullable=False, default=100.0)
    effective_weight = Column(Float, nullable=False, default=100.0)
    base_weight = Column(Float, nullable=False, default=1.0)
    approved_count = Column(Integer, nullable=False, default=0)
    corrected_count = Column(Integer, nullable=False, default=0)
    rejected_count = Column(Integer, nullable=False, default=0)
    total_reviews = Column(Integer, nullable=False, default=0)
    historical_accuracy = Column(Float, nullable=False, default=100.0)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
