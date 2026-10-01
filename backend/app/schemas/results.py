"""Pydantic v2 schemas for the Results view (record-by-record crawled output and multi-agent products)."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResultSchoolItem(BaseModel):
    """Represents a single school record row in the Results view table."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(..., description="Staging or school entity identifier")
    school_id: str = Field(..., description="Canonical UUID of the school record")
    school_name: str = Field(..., description="Official school name")
    district: str | None = Field(None, description="School district or regional authority")
    batch_id: str | None = Field(None, description="Associated batch UUID if any")
    batch_name: str | None = Field(None, description="Name of the batch")
    product_key: str = Field(..., description="Key of the selected product (e.g. info)")
    product_name: str = Field(..., description="Human-readable product name")

    value1_label: str = Field("", description="Header label for value 1 column")
    value1_value: str = Field("", description="Extracted or computed value for value 1")

    value2_label: str = Field("", description="Header label for value 2 column")
    value2_value: str = Field("", description="Extracted or computed value for value 2")

    value3_label: str = Field("", description="Header label for value 3 column")
    value3_value: str = Field("", description="Extracted or computed value for value 3")

    website: str | None = Field(None, description="Official school website URL")
    address: str | None = Field(None, description="Physical street address")
    phone: str | None = Field(None, description="Primary telephone")
    email: str | None = Field(None, description="Primary email")
    grades: list[str] = Field(default_factory=list, description="Resolved grades list")
    school_type: list[str] = Field(default_factory=list, description="School institutional type")
    description: str | None = Field(None, description="1-3 sentence summary")
    open_enrollment: bool | None = Field(None, description="Open enrollment status")
    open_enrollment_grades: list[str] = Field(
        default_factory=list, description="Grades with open enrollment"
    )
    base_tuition: str | None = Field(None, description="Base tuition amount or band")
    teaching_style: str | None = Field(None, description="Teaching style")
    learning_models: list[str] = Field(default_factory=list, description="Learning models list")
    extracurricular_programs: list[str] = Field(
        default_factory=list, description="Extracurriculars list"
    )
    post_ingestion_record: dict[str, Any] = Field(
        default_factory=dict, description="Clean post-ingestion record matching results.json"
    )

    status: str = Field(
        ..., description="Lifecycle status (Published, Verified, Needs Verification, Completed)"
    )
    crawled_at: str = Field(..., description="Formatted crawl timestamp")

    overall_score: int | None = Field(None, description="DQA Quality Score (0-100)")
    evidence_count: int = Field(0, description="Count of supporting evidence records")
    extracted_fields: dict[str, Any] = Field(
        default_factory=dict, description="Raw extracted JSON dictionary"
    )
    recommendations: list[dict[str, Any]] = Field(
        default_factory=list, description="Recommendations list"
    )
    is_promoted: bool = Field(
        False, description="True if promoted to the golden production schools table"
    )


class ResultsSummary(BaseModel):
    """Summary KPI metrics for the filtered Results view."""

    model_config = ConfigDict(str_strip_whitespace=True)

    total_records: int = 0
    published_count: int = 0
    verified_count: int = 0
    needs_verification_count: int = 0
    completed_count: int = 0


class ResultsListResponse(BaseModel):
    """Full payload returned to the Results view UI."""

    model_config = ConfigDict(str_strip_whitespace=True)

    records: list[ResultSchoolItem]
    summary: ResultsSummary
    selected_batch_id: str | None = None
    selected_product_key: str = "info"


class PromoteResultResponse(BaseModel):
    """Response payload when promoting a staging school to production."""

    model_config = ConfigDict(str_strip_whitespace=True)

    staging_id: UUID
    production_school_id: UUID
    school_name: str
    status: str = "published"
    message: str
