"""
Test factory helpers for creating ORM model instances.

Each factory function inserts a record into the given DB session and
returns the created model object. All arguments are keyword-optional so
tests only need to supply the fields they care about.

Usage
-----
    from tests.factories import make_school, make_batch, make_staging_school

    def test_something(db_session):
        school = make_school(db_session, name="Riverside Academy")
        batch  = make_batch(db_session, name="Q1 Intake")
        staging = make_staging_school(db_session, batch_id=batch.id)
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.batch import BatchModel
from app.models.cost import OpenAICostLogModel
from app.models.job import CrawlJobModel
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import EvidenceRecordModel, ResolvedValueModel, SourceRegistryModel
from app.models.prompt_template import PromptTemplateModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel


# ---------------------------------------------------------------------------
# Schools (production golden table)
# ---------------------------------------------------------------------------
def make_school(
    db: Session,
    *,
    name: str = "Springfield Elementary",
    is_active: bool = True,
    website: str | None = "https://springfield.edu",
    address: str | None = "742 Evergreen Terrace, Springfield",
    city: str | None = "Springfield",
    state: str | None = "TX",
    zip_code: str | None = "78701",
    phone: str | None = "512-555-0100",
    email: str | None = "info@springfield.edu",
    school_type: list | None = None,
    grades: list | None = None,
    profile_verification_status: str | None = None,
    deleted_at: datetime | None = None,
) -> Schools:
    """Insert and return a Schools production record."""
    school = Schools(
        id=uuid.uuid4(),
        name=name,
        is_active=is_active,
        website=website,
        url=website,
        address=address,
        city=city,
        state=state,
        zip_code=zip_code,
        phone=phone,
        email=email,
        type=school_type or ["private"],
        grades=grades or ["K", "1", "2", "3", "4", "5"],
        learning_models={},
        description="",
        has_academic_rigor=False,
        is_tefa_approved=False,
        faith_and_values=False,
        has_arts_program=False,
        hands_on_and_technical=False,
        has_sports_program=False,
        small_and_personal=False,
        learning_differences=False,
        budget_friendly=False,
        dual_language=False,
        before_after_care=False,
        transportation_provided=False,
        stem_program=False,
        open_enrollment=False,
        packet_available=False,
        profile_verification_status=profile_verification_status,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        deleted_at=deleted_at,
    )
    db.add(school)
    db.flush()
    return school


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------
def make_batch(
    db: Session,
    *,
    name: str = "Test Batch",
    description: str | None = "A test batch",
    source_type: str = "excel_upload",
    status: str = "ready",
    school_count: int = 0,
    created_by: str = "operator",
    deleted_at: datetime | None = None,
) -> BatchModel:
    """Insert and return a BatchModel record."""
    batch = BatchModel(
        id=uuid.uuid4(),
        name=name,
        description=description,
        source_type=source_type,
        status=status,
        school_count=school_count,
        created_by=created_by,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        deleted_at=deleted_at,
    )
    db.add(batch)
    db.flush()
    return batch


# ---------------------------------------------------------------------------
# Staging schools
# ---------------------------------------------------------------------------
def make_staging_school(
    db: Session,
    batch_id: uuid.UUID,
    *,
    name: str = "Staging Academy",
    website: str | None = "https://staging-academy.edu",
    address: str | None = "100 Test Street",
    district: str | None = "Test District",
    state: str | None = "TX",
    status: str = "pending",
    production_school_id: uuid.UUID | None = None,
    metadata_json: dict | None = None,
    deleted_at: datetime | None = None,
) -> StagingSchoolModel:
    """Insert and return a StagingSchoolModel record."""
    staging = StagingSchoolModel(
        id=uuid.uuid4(),
        batch_id=batch_id,
        production_school_id=production_school_id,
        name=name,
        website=website,
        address=address,
        district=district,
        state=state,
        status=status,
        source_data={"original_name": name},
        metadata_json=metadata_json
        or {
            "products": {
                "info": {"status": "not_run"},
            }
        },
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        deleted_at=deleted_at,
    )
    db.add(staging)
    db.flush()
    return staging


# ---------------------------------------------------------------------------
# Crawl jobs
# ---------------------------------------------------------------------------
def make_crawl_job(
    db: Session,
    *,
    job_id: str | None = None,
    school_id: str = "test-school-id",
    agent_name: str | None = "MetadataAgent",
    product_name: str | None = "School Info",
    status: str = "queued",
    current_step: str = "init",
    error_message: str | None = None,
) -> CrawlJobModel:
    """Insert and return a CrawlJobModel record."""
    job = CrawlJobModel(
        id=job_id or f"JOB-{uuid.uuid4().hex[:8].upper()}",
        school_id=school_id,
        agent_name=agent_name,
        product_name=product_name,
        status=status,
        current_step=current_step,
        pages_crawled=0,
        evidence_count=0,
        conflict_count=0,
        error_message=error_message,
        created_at=datetime.now(UTC),
    )
    db.add(job)
    db.flush()
    return job


# ---------------------------------------------------------------------------
# Metadata agent outputs
# ---------------------------------------------------------------------------
def make_metadata_output(
    db: Session,
    *,
    school_id: uuid.UUID | None = None,
    staging_school_id: uuid.UUID | None = None,
    batch_id: uuid.UUID | None = None,
    job_id: str = "JOB-TEST",
    overall_score: float = 80.0,
    verification_status: str = "needs_review",
    applied_to_school: bool = False,
    recommendations: list | None = None,
    extracted_fields: dict | None = None,
) -> MetadataAgentOutputModel:
    """Insert and return a MetadataAgentOutputModel record."""
    output = MetadataAgentOutputModel(
        id=uuid.uuid4(),
        school_id=school_id,
        staging_school_id=staging_school_id,
        batch_id=batch_id,
        job_id=job_id,
        overall_score=overall_score,
        verification_status=verification_status,
        applied_to_school=applied_to_school,
        recommendations=recommendations or [],
        extracted_fields=extracted_fields or {},
        created_at=datetime.now(UTC),
    )
    db.add(output)
    db.flush()
    return output


# ---------------------------------------------------------------------------
# Source registry
# ---------------------------------------------------------------------------
def make_source_registry(
    db: Session,
    *,
    source_id: str | None = None,
    domain: str = "school.edu",
    source_tier: str = "Tier 1 - Official School Website",
    base_weight: float = 0.9,
    description: str | None = "Official school portal",
    is_active: str = "true",
) -> SourceRegistryModel:
    """
    Insert and return a SourceRegistryModel record.

    Note: The ORM model has columns: id, domain, source_tier, base_weight,
    description, is_active.  The sources.py route references additional
    attributes (source_name, domain_pattern, configured_weight, etc.) that
    do NOT exist on this model — a known mismatch tracked in tests.
    """
    source = SourceRegistryModel(
        id=source_id or f"src-{uuid.uuid4().hex[:8]}",
        domain=domain,
        source_tier=source_tier,
        base_weight=base_weight,
        description=description,
        is_active=is_active,
    )
    db.add(source)
    db.flush()
    return source


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------
def make_prompt_template(
    db: Session,
    *,
    template_id: str | None = None,
    product_name: str = "Open Seats (Grade 1)",
    version: str = "v1.0",
    prompt_text: str = "Extract open seat count for Grade 1.",
    is_active: bool = True,
    approval_rate: float = 85.0,
    correction_rate: float = 10.0,
    rejection_rate: float = 5.0,
    total_evaluations: int = 100,
) -> PromptTemplateModel:
    """Insert and return a PromptTemplateModel record."""
    template = PromptTemplateModel(
        id=template_id or f"prompt-{uuid.uuid4().hex[:8]}",
        product_name=product_name,
        version=version,
        prompt_text=prompt_text,
        is_active=is_active,
        approval_rate=approval_rate,
        correction_rate=correction_rate,
        rejection_rate=rejection_rate,
        total_evaluations=total_evaluations,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(template)
    db.flush()
    return template


# ---------------------------------------------------------------------------
# Cost log entries
# ---------------------------------------------------------------------------
def make_cost_log(
    db: Session,
    *,
    agent_name: str = "MetadataAgent",
    model: str = "gpt-4o",
    school_id: str | None = None,
    batch_id: str | None = None,
    task_name: str | None = "extraction",
    prompt_tokens: int = 1000,
    completion_tokens: int = 500,
    total_tokens: int = 1500,
    cost_usd: float = 0.00015,
    duration_ms: int = 800,
    logged_at: datetime | None = None,
) -> OpenAICostLogModel:
    """Insert and return an OpenAICostLogModel record."""
    log = OpenAICostLogModel(
        id=str(uuid.uuid4()),
        agent_name=agent_name,
        model=model,
        school_id=school_id,
        batch_id=batch_id,
        task_name=task_name,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        cost_usd=round(cost_usd, 8),
        duration_ms=duration_ms,
        logged_at=logged_at or datetime.now(UTC),
    )
    db.add(log)
    db.flush()
    return log


# ---------------------------------------------------------------------------
# Resolved values
# ---------------------------------------------------------------------------
def make_resolved_value(
    db: Session,
    *,
    value_id: str | None = None,
    job_id: str = "JOB-TEST",
    school_id: str = "school-abc",
    field_name: str = "open_seats_grade1",
    chosen_value: str | None = "12",
    consensus_score: float = 0.92,
    resolution_method: str = "consensus",
    conflict_detected: str = "false",
) -> ResolvedValueModel:
    """
    Insert and return a ResolvedValueModel record.

    Note: The ORM model has no ``review_status`` column.  The published.py
    route filters on ``review_status == 'approved'`` which does not exist —
    a known schema mismatch tracked in tests.
    """
    rv = ResolvedValueModel(
        id=value_id or f"rv-{uuid.uuid4().hex[:8]}",
        job_id=job_id,
        school_id=school_id,
        field_name=field_name,
        chosen_value=chosen_value,
        consensus_score=consensus_score,
        resolution_method=resolution_method,
        conflict_detected=conflict_detected,
        resolved_at=datetime.now(UTC),
    )
    db.add(rv)
    db.flush()
    return rv


# ---------------------------------------------------------------------------
# Evidence records
# ---------------------------------------------------------------------------
def make_evidence_record(
    db: Session,
    *,
    job_id: str = "JOB-TEST",
    school_id: uuid.UUID | None = None,
    staging_school_id: uuid.UUID | None = None,
    field_name: str = "phone",
    raw_value: str | None = "512-555-0100",
    source_url: str = "https://school.edu/contact",
    source_name: str | None = "Official School Website",
    confidence_score: float = 0.95,
) -> EvidenceRecordModel:
    """Insert and return an EvidenceRecordModel record."""
    ev = EvidenceRecordModel(
        id=uuid.uuid4(),
        job_id=job_id,
        school_id=school_id,
        staging_school_id=staging_school_id,
        field_name=field_name,
        raw_value=raw_value,
        source_url=source_url,
        source_name=source_name,
        source_tier="Tier 1 - Official School Website",
        source_type="Official Portal",
        confidence_score=confidence_score,
        extracted_at=datetime.now(UTC),
    )
    db.add(ev)
    db.flush()
    return ev


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def days_ago(n: int) -> datetime:
    """Return a UTC datetime `n` days in the past — useful for retention tests."""
    return datetime.now(UTC) - timedelta(days=n)
