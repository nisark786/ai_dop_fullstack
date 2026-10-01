"""Pydantic v2 schemas for Human-in-the-Loop (HITL) Review Queue (FR-9.1 to FR-9.6)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ReviewActionResponse(BaseModel):
    """Schema for review queue actions (approve, correct, reject)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    record_id: str
    action: Literal["approved", "corrected", "rejected"]
    status: Literal["approved", "corrected", "rejected"]
    message: str


class ReviewCorrectRequest(BaseModel):
    """Schema for submitting a manual operator correction to a resolved value."""

    model_config = ConfigDict(str_strip_whitespace=True)

    corrected_value: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The corrected value provided by the human operator",
    )


class EvidenceCandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str
    source_name: str
    source_type: str
    source_category: str = "Cat 1 — Official School"
    extracted_value: str
    field_value: str
    confidence_score: float
    citation_url: str
    source_url: str
    raw_extracted_text: str | None = None
    retrieval_timestamp: str
    crawl_timestamp: str
    trust_weight: float = 100.0
    historical_accuracy: float = 95.0
    source_score: float = 95.0


class ValueGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    normalized_value: str
    candidate_count: int
    source_diversity: int
    weighted_score: float
    is_winning: bool
    evidence_ids: list[str] = Field(default_factory=list)


class ConfidenceComponentsResponse(BaseModel):
    support_strength: float = 75.0
    source_agreement: float = 80.0
    freshness: float = 90.0
    historical_consistency: float = 85.0


class ResolvedValueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str
    school_id: str
    school_name: str
    product: str = "School Profile & Metadata"
    product_name: str = "School Profile & Metadata"
    field_name: str
    academic_year: str = "2024-2025"
    previous_value: str | None = None
    winning_value: str
    final_value: str | None = None
    confidence: float
    composite_confidence: float
    confidence_components: ConfidenceComponentsResponse = Field(
        default_factory=ConfidenceComponentsResponse
    )
    decision: str = "Mandatory HITL Review"
    routing_band: str = "Mandatory HITL Review"
    review_status: str = "pending"
    has_conflict: bool = False
    total_support: float = 1.0
    dqa_score: int | None = None
    value_groups: list[ValueGroupResponse] = Field(default_factory=list)
    evidence_candidates: list[EvidenceCandidateResponse] = Field(default_factory=list)


class ReviewEvidenceItem(BaseModel):
    """Schema for individual evidence citations supporting school extraction."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str
    field_name: str
    source_name: str = "Official Portal"
    source_type: str = "Official Portal"
    source_url: str
    snippet: str | None = None
    extracted_value: str
    confidence_score: float = 85.0
    extracted_at: str | None = None


class VerificationSchoolItem(BaseModel):
    """Detailed school representation for Verification Queue, Approved Schools, and Re-crawl Queue."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str
    batch_id: str
    batch_name: str
    name: str
    website: str | None = None
    district: str | None = None
    state: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    type: list[str] = Field(default_factory=list)
    grades: list[str] = Field(default_factory=list)
    status: str
    dqa_score: int | None = None
    confidence_score: float | None = None
    evidence_count: int = 0
    extracted_fields: dict[str, str | list[str] | None] = Field(default_factory=dict)
    recommendations: list[dict[str, str | float | None]] = Field(default_factory=list)
    evidences: list[ReviewEvidenceItem] = Field(default_factory=list)
    is_published: bool = False
    production_school_id: str | None = None
    updated_at: str | None = None


class BulkReviewActionRequest(BaseModel):
    """Request payload for school-level, multi-select, and batch-level Approve / Reject / Undo / Publish."""

    model_config = ConfigDict(str_strip_whitespace=True)

    school_ids: list[str] = Field(default_factory=list, description="Target staging school UUIDs")
    batch_id: str | None = Field(
        default=None, description="Target batch UUID when scope is 'batch'"
    )
    product: str = Field(default="info", min_length=1, max_length=50)
    scope: Literal["single", "group", "batch"]
    action: Literal["approve", "reject", "undo", "publish"]
    reason: str | None = Field(default=None, max_length=1000)


class BulkReviewActionResponse(BaseModel):
    """Response payload for review actions."""

    model_config = ConfigDict(str_strip_whitespace=True)

    action: Literal["approve", "reject", "undo", "publish"]
    affected_count: int
    message: str
    updated_school_ids: list[str] = Field(default_factory=list)
