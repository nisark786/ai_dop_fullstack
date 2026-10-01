"""SQLAlchemy model for prompt templates used by extraction and planning agents."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text

from app.core.database import Base


class PromptTemplateModel(Base):
    """
    SQLAlchemy ORM Model for Prompt Templates.
    Allows versioning, operator tuning, and dynamic agent prompt retrieval from DB.
    """

    __tablename__ = "prompt_templates"

    id = Column(String(50), primary_key=True, index=True)
    product_name = Column(String(100), nullable=False, index=True)
    version = Column(String(50), nullable=False, default="v1.0")
    prompt_text = Column(Text, nullable=False)
    approval_rate = Column(Float, nullable=False, default=100.0)
    correction_rate = Column(Float, nullable=False, default=0.0)
    rejection_rate = Column(Float, nullable=False, default=0.0)
    total_evaluations = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
