"""Pydantic v2 schemas for agent execution dispatching across batches."""

from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RunMetadataAgentRequest(BaseModel):
    """Request payload for dispatching the School Profile & Metadata Agent."""

    model_config = ConfigDict(str_strip_whitespace=True)

    scope: Literal["single", "group", "batch"] = Field(
        ...,
        description="Execution scope: 'single' (1 school), 'group' (selected subset), or 'batch' (all schools)",
    )
    school_ids: list[UUID] = Field(
        default_factory=list,
        description="Target school IDs (required when scope is 'single' or 'group')",
    )
    priority: Literal["normal", "high", "low"] = Field(
        default="normal",
        description="Job scheduling priority",
    )
    force_refresh: bool = Field(
        default=False,
        description="When true, bypasses scraper cache and forces live web crawl.",
    )
    workers: int = Field(
        default=2,
        ge=1,
        le=5,
        description="Number of parallel worker threads (1-5).",
    )

    @model_validator(mode="after")
    def validate_scope_schools(self) -> Self:
        if self.scope in ("single", "group") and not self.school_ids:
            raise ValueError(f"school_ids must not be empty when scope is '{self.scope}'")
        return self


class AgentDispatchResponse(BaseModel):
    """Response returned upon successfully queueing an agent execution job."""

    job_id: str
    batch_id: UUID
    agent_id: str
    product_name: str
    target_count: int
    status: str
    message: str
