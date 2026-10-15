"""Pydantic v2 schemas for batch intake, preview, and management."""

import json
import re
from datetime import datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _normalize_string_list(v: Any) -> list[str] | None:
    if v is None:
        return None
    if isinstance(v, list):
        items = [str(item).strip() for item in v if str(item).strip()]
        return items if items else None
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        if v.startswith("[") and v.endswith("]"):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    items = [str(item).strip() for item in parsed if str(item).strip()]
                    return items if items else None
            except Exception:
                pass
        items = [part.strip() for part in v.split(",") if part.strip()]
        return items if items else None
    return None


class DuplicateMatchInfo(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    existing_school_id: str | UUID
    existing_school_name: str
    existing_website: str | None = None
    match_type: Literal["exact_domain", "fuzzy_name"]
    confidence_score: float = Field(ge=0.0, le=100.0)


class IntakeRowPreview(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    row_number: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=500)
    district: str | None = Field(default=None, max_length=150)
    state: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    type: list[str] | None = None
    grades: list[str] | None = None
    is_valid: bool
    validation_errors: list[str] = Field(default_factory=list)
    potential_duplicate: DuplicateMatchInfo | None = None
    selected_action: Literal["create", "link"] = "create"

    @field_validator("grades", "type", mode="before")
    @classmethod
    def parse_preview_list_fields(cls, v: Any) -> list[str] | None:
        return _normalize_string_list(v)


class BatchUploadPreviewResponse(BaseModel):
    filename: str
    total_rows: int = Field(ge=0)
    valid_rows_count: int = Field(ge=0)
    invalid_rows_count: int = Field(ge=0)
    duplicates_count: int = Field(ge=0)
    rows: list[IntakeRowPreview]


class BatchConfirmRow(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=500)
    district: str | None = Field(default=None, max_length=150)
    state: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    type: list[str] | None = None
    grades: list[str] | None = None
    action: Literal["create", "link"] = "create"
    link_school_id: str | UUID | None = None

    @field_validator("grades", "type", mode="before")
    @classmethod
    def parse_confirm_list_fields(cls, v: Any) -> list[str] | None:
        return _normalize_string_list(v)

    @model_validator(mode="after")
    def validate_action_fields(self) -> Self:
        if self.action == "link":
            if not self.link_school_id:
                raise ValueError("link_school_id is required when action is 'link'")
        elif self.action == "create" and not self.website and not self.address:
            raise ValueError("Either website or address must be provided for created schools")
        return self


class BatchConfirmCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    source_type: Literal["excel_upload", "csv_upload", "manual", "library_selection"] = (
        "excel_upload"
    )
    rows: list[BatchConfirmRow] = Field(
        min_length=1, description="At least one school row is required to create a batch"
    )


class BatchUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class AddBatchSchoolRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    school_id: UUID | None = None
    name: str | None = Field(default=None, min_length=2, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=500)
    district: str | None = Field(default=None, max_length=150)
    state: str | None = Field(default=None, max_length=50)

    @field_validator("website")
    @classmethod
    def sanitize_website(cls, v: str | None) -> str | None:
        if not v:
            return None
        v_stripped = v.strip()
        if not v_stripped:
            return None
        if not re.match(r"^(https?://)?[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", v_stripped):
            raise ValueError("Invalid website domain or URL format")
        return v_stripped

    @field_validator("state")
    @classmethod
    def sanitize_state(cls, v: str | None) -> str | None:
        if not v:
            return None
        return v.strip().upper()

    @model_validator(mode="after")
    def validate_identification(self) -> Self:
        if self.school_id:
            return self

        # When creating manual school, name is required
        if not self.name or len(self.name.strip()) < 2:
            raise ValueError(
                "School name (min 2 characters) is required when school_id is not provided"
            )

        if not self.website and not self.address:
            raise ValueError("Either website or address must be provided when adding a new school")

        return self


class PurgeTrashResponse(BaseModel):
    purged_count: int
    message: str


class BatchSummaryItem(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    source_type: str
    status: str
    school_count: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    days_remaining: int | None = None


class BatchDetailSchoolItem(BaseModel):
    school_id: UUID
    name: str
    website: str | None = None
    address: str | None = None
    district: str | None = None
    state: str | None = None
    status: str
    added_at: datetime
    products: dict[str, Any] = Field(default_factory=dict)


class ProductProgressItem(BaseModel):
    product_id: str
    product_name: str
    unprocessed_count: int
    processing_count: int
    verified_count: int
    failed_count: int


class BatchDetailResponse(BaseModel):
    batch: BatchSummaryItem
    schools: list[BatchDetailSchoolItem]
    product_matrix: list[ProductProgressItem]


class BulkDropSchoolsRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    school_ids: list[str] = Field(min_length=1, max_length=500)


class BulkDropSchoolsResponse(BaseModel):
    message: str
    batch_id: str
    dropped_count: int
    remaining_schools: int
