"""
Pydantic schemas for Batch Pipeline Runs, Execution Outputs, and Export Endpoints.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BatchRunSummary(BaseModel):
    """Aggregated summary of a pipeline execution run for a batch."""

    model_config = ConfigDict(str_strip_whitespace=True)

    job_id: str = Field(..., description="Unique job execution identifier")
    batch_id: UUID | None = Field(default=None, description="Target batch ID")
    batch_name: str = Field(..., description="Human-readable batch name")
    agent_name: str = Field(
        default="School Profile & Metadata Agent", description="Executing AI Agent"
    )
    agent_version: str = Field(default="1.2.0", description="Agent release version")
    total_schools: int = Field(default=0, description="Total schools processed in this run")
    verified_count: int = Field(default=0, description="Count of schools meeting quality threshold")
    needs_review_count: int = Field(
        default=0, description="Count of schools flagged for HITL review"
    )
    avg_score: int = Field(default=0, description="Average DQA composite score")
    cache_hits_total: int = Field(default=0, description="Total cached pages reused in this run")
    status: str = Field(default="completed", description="Execution status")
    created_at: str = Field(..., description="ISO execution timestamp")


class SchoolRunOutputItem(BaseModel):
    """Per-school structured output and extracted metadata for an execution run."""

    model_config = ConfigDict(str_strip_whitespace=True)

    school_id: str = Field(..., description="Unique school UUID string")
    school_name: str = Field(..., description="Canonical school name")
    website: str | None = Field(default=None, description="Official website URL")
    address: str | None = Field(default=None, description="Campus address")
    overall_score: int = Field(default=0, description="DQA score percentage")
    verification_status: str = Field(default="needs_review", description="verified or needs_review")
    extracted_fields: dict[str, Any] = Field(
        default_factory=dict, description="Dictionary of extracted school attributes"
    )
    recommendations: list[dict[str, Any]] = Field(
        default_factory=list, description="List of proposed attribute corrections"
    )
    pages_crawled_count: int = Field(default=0, description="Pages crawled via Firecrawl")
    cache_hits_count: int = Field(default=0, description="Pages loaded from local cache")
    applied_to_school: bool = Field(
        default=False, description="Whether recommendations were applied to master catalog"
    )
    crawled_at: str = Field(..., description="Extraction completion timestamp")


class BatchRunDetailResponse(BaseModel):
    """Complete detail response of a batch pipeline run including all schools."""

    model_config = ConfigDict(str_strip_whitespace=True)

    summary: BatchRunSummary
    schools: list[SchoolRunOutputItem]
