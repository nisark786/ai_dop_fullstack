from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SchoolResponseSchema(BaseModel):
    """Schema for returning authentic school records from Supabase."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    website: str | None = None
    url: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    phone: str | None = None
    email: str | None = None
    description: str | None = None
    type: list[str] = Field(default_factory=list)
    grades: list[str] = Field(default_factory=list)
    is_active: bool = True
    profile_verification_status: str | None = None
    profile_verified_at: datetime | None = None
    rating: float | None = None
    places_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PaginatedSchoolsResponse(BaseModel):
    """Envelope for paginated school queries."""

    items: list[SchoolResponseSchema]
    total: int
    page: int
    page_size: int
    total_pages: int


class SchoolCreateSchema(BaseModel):
    """Schema for creating a new school in the master directory."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=255, description="Official school name")
    website: str | None = Field(default=None, max_length=500, description="Official website URL")
    url: str | None = Field(default=None, max_length=500, description="Alternative URL")
    address: str | None = Field(default=None, max_length=500, description="Street address")
    city: str | None = Field(default=None, max_length=100, description="City")
    state: str | None = Field(default="TX", max_length=50, description="State (default TX)")
    zip_code: str | None = Field(default=None, max_length=20, description="ZIP code")
    phone: str | None = Field(default=None, max_length=50, description="Primary telephone")
    email: str | None = Field(default=None, max_length=100, description="Contact email")
    description: str | None = Field(default=None, description="Overview or description")
    type: list[str] = Field(
        default_factory=list, description="Classifications: Public, Charter, Private, Magnet"
    )
    grades: list[str] = Field(default_factory=list, description="Grades offered: PK, KG, 1, 2, ...")
    is_active: bool = Field(default=True, description="Active status")
    profile_verification_status: (
        Literal["verified", "pending", "needs_review", "unverified"] | None
    ) = Field(default="pending", description="Initial verification status")


class SchoolUpdateSchema(BaseModel):
    """Schema for updating a school record or toggling active status."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    url: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=50)
    zip_code: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None)
    type: list[str] | None = Field(default=None)
    grades: list[str] | None = Field(default=None)
    is_active: bool | None = None
    profile_verification_status: (
        Literal["verified", "pending", "needs_review", "unverified"] | None
    ) = None


class SchoolStatsSchema(BaseModel):
    """Schema for high-level school database counts."""

    total_schools: int
    active_schools: int
    inactive_schools: int
    verified_schools: int
    pending_schools: int


class SchoolActionResponse(BaseModel):
    """Generic action confirmation response."""

    model_config = ConfigDict(str_strip_whitespace=True)

    school_id: str
    message: str
    status: str


class SchoolTrashItem(BaseModel):
    """Schema for schools quarantined in the Trash Bucket."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str
    name: str
    address: str | None = None
    city: str | None = None
    state: str | None = None
    website: str | None = None
    type: list[str] = Field(default_factory=list)
    grades: list[str] = Field(default_factory=list)
    deleted_at: datetime
    days_remaining: int
