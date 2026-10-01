"""Pydantic v2 schemas for source registry and trust weighting."""

from pydantic import BaseModel, ConfigDict, Field


class SourceWeightUpdateRequest(BaseModel):
    """Schema for updating a data source's baseline trust weight."""

    model_config = ConfigDict(str_strip_whitespace=True)

    new_weight: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Configured baseline trust weight between 0.0 and 100.0",
    )


class SourceWeightUpdateResponse(BaseModel):
    """Schema for source weight modification confirmation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    source_id: str
    effective_weight: float
    message: str


class SourceResponse(BaseModel):
    """Schema for returning source registry entities."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    source_name: str
    domain_pattern: str
    category: str
    configured_weight: float
    effective_weight: float
    approved_count: int
    corrected_count: int
    rejected_count: int
    total_reviews: int
    historical_accuracy: float
    is_active: bool
