"""Pydantic v2 schemas for crawl and extraction job orchestration."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class JobCreateRequest(BaseModel):
    """Schema for triggering an agent crawl extraction job."""

    model_config = ConfigDict(str_strip_whitespace=True)

    agent_name: str = Field(
        default="MetadataAgent",
        min_length=2,
        max_length=100,
        description="Name of the agent to execute",
    )
    product_name: str = Field(
        default="School Profile & Metadata",
        min_length=2,
        max_length=100,
        description="Target data product name",
    )
    school_id: str = Field(
        default="batch-manual",
        min_length=1,
        max_length=50,
        description="School or batch identifier to associate with the job",
    )


class CrawlJobResponse(BaseModel):
    """Schema for returning crawl job status records aligned with the crawl_jobs table."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    school_id: str
    agent_name: str | None
    product_name: str | None
    status: str
    current_step: str | None
    pages_crawled: int
    evidence_count: int
    conflict_count: int
    error_message: str | None
    created_at: datetime | None
    completed_at: datetime | None


class JobStartResponse(BaseModel):
    """Schema for job creation confirmation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    job_id: str
    message: str
    status: str
