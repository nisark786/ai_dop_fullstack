"""Pydantic v2 schemas for Agent Registry, Batch Execution, and Job Monitoring (FR-4, FR-5, FR-7)."""

from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.agent_dispatch import AgentDispatchResponse


class AgentRegistryItem(BaseModel):
    """Metadata definition for a data product agent registered in the platform."""

    model_config = ConfigDict(str_strip_whitespace=True)

    product_key: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Unique identifier for the product, e.g. 'info', 'tuition'",
    )
    product_name: str = Field(
        ..., min_length=1, max_length=150, description="Display name for the data product"
    )
    agent_id: str = Field(
        ..., min_length=1, max_length=100, description="Unique agent identifier string"
    )
    agent_name: str = Field(
        ..., min_length=1, max_length=150, description="Display name for the agent"
    )
    version: str = Field(
        ..., min_length=1, max_length=30, description="Agent semantic version string"
    )
    status: Literal["active", "coming_soon"] = Field(
        default="coming_soon",
        description="Whether the agent is currently executable or pending implementation",
    )
    is_implemented: bool = Field(
        default=False,
        description="True if backend execution pipeline exists for this agent",
    )
    description: str = Field(
        ..., min_length=1, max_length=500, description="Functional summary of agent capabilities"
    )
    target_fields: list[str] = Field(
        default_factory=list,
        description="List of database / domain fields extracted by this agent",
    )
    model_name: str = Field(
        default="gpt-6-luna",
        description="Underlying LLM model powering extraction and validation",
    )
    dispatch_endpoint: str | None = Field(
        default=None,
        description="Target REST endpoint path for dispatching runs",
    )


class RunAgentsForBatchRequest(BaseModel):
    """Payload to trigger one or more agents across one or more batches."""

    model_config = ConfigDict(str_strip_whitespace=True)

    batch_ids: list[UUID] = Field(
        default_factory=list,
        description="List of target batch identifiers to execute across",
    )
    batch_id: UUID | None = Field(
        default=None,
        description="Legacy single batch ID for backwards compatibility",
    )
    agent_keys: list[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of product keys to execute (e.g. ['info'])",
    )
    scope: Literal["batch", "group", "single"] = Field(
        default="batch",
        description="Execution scope: 'batch' (all schools), 'group' (subset), or 'single'",
    )
    school_ids: list[UUID] = Field(
        default_factory=list,
        description="Specific school IDs if scope is 'group' or 'single'",
    )
    priority: Literal["normal", "high", "low"] = Field(
        default="normal",
        description="Queue scheduling priority (defaults to normal)",
    )
    force_refresh: bool = Field(
        default=False,
        description="When true, bypasses scraper cache and forces live web crawl via Firecrawl.",
    )
    workers: int = Field(
        default=2,
        ge=1,
        le=5,
        description="Number of parallel worker threads (1-5).",
    )

    @model_validator(mode="after")
    def validate_batches_and_scope(self) -> Self:
        if self.batch_id and self.batch_id not in self.batch_ids:
            self.batch_ids.append(self.batch_id)
        if not self.batch_ids:
            raise ValueError("At least one target batch must be specified in batch_ids.")
        if self.scope in ("single", "group") and not self.school_ids:
            raise ValueError(f"school_ids must not be empty when scope is '{self.scope}'")
        return self


class RunAgentsForBatchResponse(BaseModel):
    """Response returned after queueing batch agent executions."""

    model_config = ConfigDict(str_strip_whitespace=True)

    dispatched: list[AgentDispatchResponse] = Field(
        default_factory=list, description="List of successfully dispatched agent jobs"
    )
    skipped: list[str] = Field(
        default_factory=list,
        description="Agent keys that were skipped because they are not yet implemented",
    )
    message: str = Field(..., description="Summary status message")


class AgentJobSummary(BaseModel):
    """Real-time operational summary of an agent run across a batch."""

    model_config = ConfigDict(str_strip_whitespace=True)

    job_id: str
    batch_id: UUID
    product_key: str
    product_name: str
    agent_id: str
    status: Literal["pending", "running", "paused", "completed", "failed", "cancelled"]
    target_count: int = Field(ge=0, description="Total target schools in this job scope")
    completed_count: int = Field(ge=0, description="Number of schools successfully processed")
    failed_count: int = Field(ge=0, description="Number of schools that failed processing")
    started_at: datetime | None = None
    finished_at: datetime | None = None
    elapsed_seconds: float | None = None
    error: str | None = None


class JobActionResponse(BaseModel):
    """Response returned after performing a control action (pause, resume, cancel) on a job."""

    model_config = ConfigDict(str_strip_whitespace=True)

    job_id: str
    batch_id: str | None = None
    status: str
    message: str
