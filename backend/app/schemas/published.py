"""Pydantic v2 schemas for published golden records."""

from pydantic import BaseModel, ConfigDict


class PublishedRecordResponse(BaseModel):
    """Schema for a single published verified record."""

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    id: str
    school_id: str
    staging_school_id: str | None = None
    school_name: str
    district: str | None = None
    product: str
    field_name: str | None = None
    verified_value: str
    confidence_score: float
    published_at: str
    sandbox_sync: dict | None = None
