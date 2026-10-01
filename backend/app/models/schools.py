"""
SQLAlchemy models for the schools domain.
Authoritative production model for the golden `schools` table.
"""

from sqlalchemy import (
    CHAR,
    Boolean,
    Column,
    DateTime,
    Enum,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.database import Base


class Schools(Base):
    """Model for table `schools` (Authoritative Production Golden Records)."""

    __tablename__ = "schools"

    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(Text, nullable=False)
    type = Column(JSONB, nullable=False)
    grades = Column(JSONB, nullable=False)
    address = Column(Text, nullable=True)
    full_address = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    website = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    learning_models = Column(JSONB, nullable=False)
    latitude = Column(Numeric, nullable=True)
    longitude = Column(Numeric, nullable=True)
    booth_location = Column(Text, nullable=True)
    exhibitor_type = Column(Text, nullable=True)
    has_academic_rigor = Column(Boolean, nullable=False)
    base_tuition = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False)
    is_tefa_approved = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True, index=True)
    rating = Column(Numeric, nullable=True)
    faith_and_values = Column(Boolean, nullable=False)
    has_arts_program = Column(Boolean, nullable=False)
    hands_on_and_technical = Column(Boolean, nullable=False)
    has_sports_program = Column(Boolean, nullable=False)
    small_and_personal = Column(Boolean, nullable=False)
    learning_differences = Column(Boolean, nullable=False)
    budget_friendly = Column(Boolean, nullable=False)
    accreditation_tier = Column(Text, nullable=True)
    accreditor_name = Column(Text, nullable=True)
    accreditor_type = Column(Text, nullable=True)
    tea_report_grade = Column(
        Enum("A", "B", "C", "D", "E", "F", name="schools_tea_report_grade_enum", create_type=False),
        nullable=True,
    )
    diverse_community = Column(Boolean, nullable=True)
    college_prep = Column(Boolean, nullable=True)
    priority_keywords = Column(JSONB, nullable=True)
    special_needs_support = Column(Text, nullable=True)
    religious_affiliation = Column(Text, nullable=True)
    school_size = Column(Text, nullable=True)
    dual_language = Column(Boolean, nullable=False)
    before_after_care = Column(Boolean, nullable=False)
    transportation_provided = Column(Boolean, nullable=False)
    stem_program = Column(Boolean, nullable=False)
    teaching_style = Column(Text, nullable=True)
    teaching_style_secondary = Column(Text, nullable=True)
    extracurricular_programs = Column(JSONB, nullable=True)
    private_rubric_parent_experience = Column(Numeric, nullable=True)
    private_rubric_notes = Column(Text, nullable=True)
    private_rubric_total = Column(Numeric, nullable=True)
    private_rubric_academic_rigor = Column(Numeric, nullable=True)
    private_rubric_culture_safety = Column(Numeric, nullable=True)
    private_rubric_leadership = Column(Numeric, nullable=True)
    private_rubric_student_support = Column(Numeric, nullable=True)
    private_rubric_accreditation = Column(Numeric, nullable=True)
    alternative_classification = Column(Text, nullable=True)
    open_enrollment = Column(Boolean, nullable=False)
    special_ed_support_types = Column(JSONB, nullable=True)
    special_ed_support_levels = Column(JSONB, nullable=True)
    claimed_by_user_id = Column(UUID(as_uuid=True), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    recruitment_contact_name = Column(Text, nullable=True)
    recruitment_contact_email = Column(Text, nullable=True)
    recruitment_contact_phone = Column(Text, nullable=True)
    places_id = Column(Text, nullable=True)
    hhs_operation_number = Column(Text, nullable=True)
    scheduling_method = Column(Text, nullable=True)
    packet_available = Column(Boolean, nullable=False)
    automation_tier = Column(Text, nullable=True)
    packet_data = Column(Text, nullable=True)
    cal_username = Column(Text, nullable=True)
    cal_event_slug = Column(Text, nullable=True)
    cal_event_type_id = Column(Integer, nullable=True)
    cal_provisioned_at = Column(DateTime, nullable=True)
    cal_managed_user_id = Column(Integer, nullable=True)
    cal_schedule_id = Column(Integer, nullable=True)
    cal_access_token_enc = Column(Text, nullable=True)
    cal_refresh_token_enc = Column(Text, nullable=True)
    cal_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    cal_timezone = Column(Text, nullable=True)
    cal_tour_availability = Column(JSONB, nullable=True)
    description_es = Column(Text, nullable=True)
    packet_data_es = Column(Text, nullable=True)
    email = Column(Text, nullable=True)
    recruitment_contacts = Column(JSONB, nullable=True)
    school_admin_package = Column(Text, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    county = Column(String, nullable=True)
    region = Column(String, nullable=True)
    external_id = Column(String, nullable=True)
    external_id_type = Column(String, nullable=True)
    external2_id = Column(String, nullable=True)
    external2_id_type = Column(String, nullable=True)
    nces_id = Column(String, nullable=True)
    district_id = Column(String, nullable=True)
    district_name = Column(String, nullable=True)
    district_type = Column(String, nullable=True)
    url_slug = Column(Text, nullable=True)
    short_id = Column(CHAR, nullable=True)
    slug_updated_at = Column(DateTime(timezone=True), nullable=True)
    application_link = Column(Text, nullable=True)
    sped_data_availability = Column(Boolean, nullable=True)
    sped_support_class = Column(JSONB, nullable=True)
    school_tier_id = Column(UUID(as_uuid=True), nullable=True)
    profile_verification_status = Column(Text, nullable=True)
    profile_verified_at = Column(DateTime, nullable=True)
    full_day = Column(Boolean, nullable=True)
    half_day = Column(Boolean, nullable=True)
    nurturing_environment = Column(Boolean, nullable=True)

    def __repr__(self) -> str:
        return f"<Schools {self.name} ({self.id})>"


# Aliases for backward compatibility
School = Schools
SchoolModel = Schools

__all__ = ["Schools", "School", "SchoolModel"]
