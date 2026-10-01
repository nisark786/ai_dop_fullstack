"""Pydantic v2 schemas for Prompt Template configuration and updates."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PromptTemplateResponse(BaseModel):
    """Schema for prompt template with performance metrics."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str
    product_name: str
    version: str
    prompt_text: str
    approval_rate: float
    correction_rate: float
    rejection_rate: float
    total_evaluations: int
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PromptTemplateUpdateRequest(BaseModel):
    """Schema for updating a prompt template."""

    model_config = ConfigDict(str_strip_whitespace=True)

    prompt_text: str = Field(
        ..., min_length=10, max_length=10000, description="Updated prompt text"
    )
    version: str | None = Field(
        default=None, max_length=50, description="Optional new version label"
    )
    is_active: bool | None = Field(default=None, description="Whether the prompt is active")
