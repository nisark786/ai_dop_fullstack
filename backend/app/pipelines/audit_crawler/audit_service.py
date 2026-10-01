import time
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import CrawlJobModel, EvidenceRecordModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.pipelines.audit_crawler.extraction_agent import ExtractionAgent
from app.pipelines.audit_crawler.planning_agent import (
    PlanningAgent,
    is_directory_or_aggregator_url,
)
from app.pipelines.audit_crawler.schemas import (
    DQAReport,
    FieldDefinition,
    SchemaKnowledgeBase,
)

PRIORITY_FIELDS = [
    "name",
    "grades",
    "address",
    "full_address",
    "website",
    "phone",
    "email",
    "description",
    "open_enrollment",
    "base_tuition",
    "extracurricular_programs",
    "learning_models",
    "teaching_style",
    "open_enrollment_grades",
]


def build_default_schema_kb() -> SchemaKnowledgeBase:
    """Constructs the canonical schema knowledge base matching the standalone audit specification."""
    kb_fields = {
        "name": FieldDefinition(
            field="name",
            type="string",
            nullable=False,
            description="Official name of the school or daycare",
        ),
        "address": FieldDefinition(
            field="address",
            type="string",
            nullable=True,
            description="Physical street address",
        ),
        "website": FieldDefinition(
            field="website",
            type="string",
            nullable=True,
            description="Official website portal URL",
        ),
        "phone": FieldDefinition(
            field="phone",
            type="string",
            nullable=True,
            description="Primary telephone number",
        ),
        "email": FieldDefinition(
            field="email",
            type="string",
            nullable=True,
            description="Primary contact email",
        ),
        "type": FieldDefinition(
            field="type",
            type="ARRAY",
            nullable=True,
            description="Institutional classification",
            allowed_values=["private", "public", "charter", "magnet", "partnership"],
        ),
        "grades": FieldDefinition(
            field="grades",
            type="ARRAY",
            nullable=True,
            description="Grades or classroom age-groups offered",
            allowed_values=[
                "Infant",
                "Toddler",
                "Preschool",
                "Pre-K 3",
                "Pre-K 4",
                "Pre-K",
                "Kindergarten",
                "1st grade",
                "2nd grade",
                "3rd grade",
                "4th grade",
                "5th grade",
                "6th grade",
                "7th grade",
                "8th grade",
                "9th grade",
                "10th grade",
                "11th grade",
                "12th grade",
            ],
        ),
        "description": FieldDefinition(
            field="description",
            type="string",
            nullable=True,
            description="Concise 1-3 sentence factual overview of the school",
        ),
        "open_enrollment": FieldDefinition(
            field="open_enrollment",
            type="boolean",
            nullable=True,
            description="Whether the school currently has open spots or active enrollment",
        ),
        "base_tuition": FieldDefinition(
            field="base_tuition",
            type="string",
            nullable=True,
            description="Base annual tuition or fee range",
        ),
        "extracurricular_programs": FieldDefinition(
            field="extracurricular_programs",
            type="ARRAY",
            nullable=True,
            description="Co-curricular and after-school programs offered",
            allowed_values=[
                "Athletics/Sports",
                "Music/Band",
                "Theatre/Drama",
                "Robotics/STEM",
                "Art",
                "Debate",
                "Dance",
                "Clubs",
            ],
        ),
        "learning_models": FieldDefinition(
            field="learning_models",
            type="ARRAY",
            nullable=True,
            description="Pedagogical and instructional models",
            allowed_values=[
                "montessori",
                "classical",
                "project_based",
                "traditional",
                "structured",
                "play_based",
                "child_centered_learning",
                "balanced",
                "stem",
                "dual_language",
                "single_gender",
                "career_and_technical_education",
                "culturally_responsive",
            ],
        ),
        "teaching_style": FieldDefinition(
            field="teaching_style",
            type="string",
            nullable=True,
            description="Teaching methodology or instructional style",
            allowed_values=[
                "montessori",
                "classical",
                "project_based",
                "traditional",
                "structured",
                "play_based",
                "child_centered",
                "balanced",
                "stem",
                "bilingual",
                "single_gender",
                "vocational",
                "culturally_responsive",
            ],
        ),
        "open_enrollment_grades": FieldDefinition(
            field="open_enrollment_grades",
            type="ARRAY",
            nullable=True,
            description="The list of specific grades that currently have open enrollment or available spots.",
            allowed_values=[
                "Infant",
                "Toddler",
                "Preschool",
                "Pre-K 3",
                "Pre-K 4",
                "Pre-K",
                "Kindergarten",
                "1st grade",
                "2nd grade",
                "3rd grade",
                "4th grade",
                "5th grade",
                "6th grade",
                "7th grade",
                "8th grade",
                "9th grade",
                "10th grade",
                "11th grade",
                "12th grade",
            ],
        ),
    }

    return SchemaKnowledgeBase(model_name="schools", fields=kb_fields, enums={})


class SchoolAuditService:
    """Coordinates the full metadata audit and quality assurance pipeline:

    1. Inspects authentic school data from PostgreSQL.
    2. Detects dead, aggregator, or directory URLs and discovers real official website via Tavily.
    3. Resolves generic district portals to individual campus-specific URLs.
    4. Maps targeted subpages (Admissions, Academics, Tuition, Contact, Early Childhood).
    5. Scrapes clean Markdown via Firecrawl with 6s throttling and 429 backoff.
    6. Validates metadata and calculates confidence score via configured LLM (gpt-6-luna).
    7. Reactivates school: Sets `is_active = True` and `profile_verification_status = 'verified'` if score >= 75%.
    8. Persists evidence citations and job logs.
    """

    def __init__(self):
        self.planning_agent = PlanningAgent()
        self.extraction_agent = ExtractionAgent()
        self.schema_kb = build_default_schema_kb()

    def audit_single_school(
        self,
        school_id: str,
        db: Session,
        attempt: int = 1,
        force_url: str | None = None,
        job_id: str | None = None,
        batch_id: str | None = None,
        force_refresh: bool = False,
    ) -> DQAReport:
        from app.cost_tracking.context import set_cost_context

        set_cost_context(
            agent_name="MetadataAgent",
            school_id=str(school_id),
            batch_id=str(batch_id) if batch_id else None,
            task_name="audit_single_school",
        )

        try:
            uuid_obj = UUID(school_id)
        except ValueError as err:
            raise ValueError(f"Invalid UUID '{school_id}'") from err

        staging_school = (
            db.query(StagingSchoolModel).filter(StagingSchoolModel.id == uuid_obj).first()
        )
        school = None
        if not staging_school:
            school = db.query(Schools).filter(Schools.id == uuid_obj).first()
            if not school:
                raise ValueError(f"School '{school_id}' not found in database.")

        target_id = staging_school.id if staging_school else school.id
        target_name = staging_school.name if staging_school else school.name
        target_address = (
            staging_school.address if staging_school else (school.address or school.full_address)
        )
        target_city = (
            getattr(staging_school, "city", "")
            if staging_school
            else (school.city if school else "")
        )
        target_state = (
            getattr(staging_school, "state", "TX")
            if staging_school
            else (school.state if school else "TX")
        )
        target_zip = (
            getattr(staging_school, "zip_code", "")
            if staging_school
            else (school.zip_code if school else "")
        )
        target_phone = staging_school.phone if staging_school else school.phone
        target_email = staging_school.email if staging_school else school.email
        target_type = (
            (
                staging_school.type
                if isinstance(staging_school.type, list)
                else ([staging_school.type] if staging_school.type else [])
            )
            if staging_school
            else (school.type if isinstance(school.type, list) else [])
        )
        target_grades = (
            (staging_school.grades if isinstance(staging_school.grades, list) else [])
            if staging_school
            else (school.grades if isinstance(school.grades, list) else [])
        )
        target_desc = (
            (staging_school.metadata_json or {}).get("description")
            if staging_school
            else (school.description if school else None)
        )

        website_url = force_url or (staging_school.website if staging_school else school.website)
        if (
            not website_url
            and school
            and school.url
            and not is_directory_or_aggregator_url(school.url)
        ):
            website_url = school.url

        # Step 1: Detect aggregator, missing, or third-party directory URL
        if not website_url or is_directory_or_aggregator_url(website_url):
            location_hint = f"{target_address or ''}, {target_city or ''}, {target_state or 'TX'}"
            email_hint = target_email or ""

            discovered_url = self.planning_agent.find_correct_website(
                target_name, location_hint, email_hint
            )
            if discovered_url:
                website_url = discovered_url
                if staging_school:
                    staging_school.website = discovered_url
                elif school:
                    school.website = discovered_url
                db.commit()

        # Step 2: Detect generic district homepage and resolve campus subdomain/path
        if website_url and self.planning_agent.is_district_portal(website_url):
            campus_url = self.planning_agent.find_campus_in_isd_directory(website_url, target_name)
            if campus_url and campus_url != website_url:
                website_url = campus_url
                if staging_school:
                    staging_school.website = campus_url
                elif school:
                    school.website = campus_url
                db.commit()

        if not website_url:
            report = DQAReport(
                school_id=school_id,
                school_name=target_name,
                overall_score=0,
                status_changed_to="Needs Review",
                recommendations=[],
            )
            if staging_school:
                staging_school.status = "needs_review"
                staging_school.updated_at = datetime.now(UTC)
            elif school:
                school.is_active = False
                school.profile_verification_status = "needs_review"
                school.updated_at = datetime.now(UTC)
            db.commit()
            return report

        # Step 3: Map subpages & create targeted plan
        subpage_urls = self.planning_agent.map_website(website_url)
        if len(subpage_urls) > 50:
            subpage_urls = subpage_urls[:50]

        plan = self.planning_agent.create_execution_plan(school_id, subpage_urls, self.schema_kb)

        # Step 4: Scrape selected subpages via Firecrawl (or local cache)
        scraped_contents = []
        for target_url in plan.selected_urls:
            text = self.extraction_agent.scrape_website(
                target_url, school_id=uuid_obj, force_refresh=force_refresh
            )
            if text:
                scraped_contents.append(f"--- SOURCE: {target_url} ---\n{text}")

        combined_text = "\n\n".join(scraped_contents)

        if not combined_text:
            report = DQAReport(
                school_id=school_id,
                school_name=target_name,
                overall_score=15,
                status_changed_to="Needs Review",
                recommendations=[],
            )
            if staging_school:
                staging_school.status = "needs_review"
                staging_school.updated_at = datetime.now(UTC)
            elif school:
                school.is_active = False
                school.profile_verification_status = "needs_review"
                school.updated_at = datetime.now(UTC)
            db.commit()
            return report

        # Step 5: Validate with configured LLM (gpt-6-luna)
        current_data = {
            "id": str(target_id),
            "name": target_name,
            "website": website_url,
            "address": target_address,
            "city": target_city,
            "state": target_state,
            "zip_code": target_zip,
            "phone": target_phone,
            "email": target_email,
            "type": target_type,
            "grades": target_grades,
            "description": target_desc,
            "is_active": True if staging_school else school.is_active,
            "profile_verification_status": (
                staging_school.status if staging_school else school.profile_verification_status
            ),
        }

        report = self.extraction_agent.validate_school(
            school_id=school_id,
            current_data=current_data,
            website_text=combined_text,
            schema_kb=self.schema_kb,
        )
        report.school_name = target_name

        # Step 6: Re-audit if LLM found a better school-specific URL
        if attempt == 1:
            web_rec = next(
                (r for r in report.recommendations if r.field == "website" and r.recommended),
                None,
            )
            if web_rec:
                recommended_url = str(web_rec.recommended)
                current_normalized = website_url.rstrip("/").replace("http://", "https://")
                recommended_normalized = recommended_url.rstrip("/").replace("http://", "https://")
                if (
                    recommended_normalized != current_normalized
                    and not is_directory_or_aggregator_url(recommended_url)
                ):
                    if staging_school:
                        staging_school.website = recommended_url
                    elif school:
                        school.website = recommended_url
                    db.commit()
                    return self.audit_single_school(
                        school_id,
                        db,
                        attempt=2,
                        force_url=recommended_url,
                        job_id=job_id,
                    )

            if report.overall_score == 0:
                new_candidate = self.planning_agent.find_correct_website(
                    target_name,
                    f"{target_address or ''}, {target_city or ''}",
                    target_email or "",
                )
                if new_candidate and new_candidate != website_url:
                    return self.audit_single_school(
                        school_id, db, attempt=2, force_url=new_candidate, job_id=job_id
                    )

        # Step 7: Apply verified updates & persist evidence
        active_job_id = job_id or f"JOB-{int(time.time() * 1000) % 100000}"

        if staging_school:
            staging_school.status = "needs_verification"
            report.status_changed_to = staging_school.status
            for rec in report.recommendations:
                val = rec.recommended
                if val is not None and val != "":
                    if rec.field == "name" and isinstance(val, str):
                        staging_school.name = val
                    elif rec.field == "address" and isinstance(val, str):
                        staging_school.address = val
                    elif rec.field == "phone" and isinstance(val, str):
                        staging_school.phone = val
                    elif rec.field == "email" and isinstance(val, str):
                        staging_school.email = val
                    elif rec.field == "type":
                        staging_school.type = [val] if isinstance(val, str) else val
                    elif rec.field == "grades" and isinstance(val, list):
                        staging_school.grades = val

            meta = dict(staging_school.metadata_json or {})
            prods = dict(meta.get("products") or {})
            prods["info"] = {
                "status": staging_school.status,
                "score": report.overall_score,
                "job_id": active_job_id,
                "completed_at": datetime.now(UTC).isoformat(),
            }
            meta["products"] = prods
            staging_school.metadata_json = meta
            staging_school.updated_at = datetime.now(UTC)
        elif school:
            if report.overall_score >= 75:
                report.status_changed_to = "Verified"
                school.is_active = True
                school.profile_verification_status = "verified"
                school.profile_verified_at = datetime.now(UTC)
            elif report.overall_score > 0:
                report.status_changed_to = "Needs Review"
                school.profile_verification_status = "needs_review"
            else:
                report.status_changed_to = "Invalid"
                school.is_active = False
                school.profile_verification_status = "needs_review"

            school.updated_at = datetime.now(UTC)

            # Apply recommended values
            for rec in report.recommendations:
                val = rec.recommended
                if val is not None and val != "":
                    if rec.field == "name" and isinstance(val, str):
                        school.name = val
                    elif rec.field == "address" and isinstance(val, str):
                        school.address = val
                    elif rec.field == "phone" and isinstance(val, str):
                        school.phone = val
                    elif rec.field == "email" and isinstance(val, str):
                        school.email = val
                    elif rec.field == "type":
                        school.type = [val] if isinstance(val, str) else val
                    elif rec.field == "grades" and isinstance(val, list):
                        school.grades = val
                    elif rec.field == "description" and isinstance(val, str):
                        school.description = val

        # Build clean post-ingestion record matching standalone script results.json exactly
        post_ingestion_record = {
            "id": str(target_id),
            "name": target_name,
            "address": target_address,
            "phone": target_phone,
            "email": target_email,
            "website": website_url,
            "type": target_type or ["private"],
            "grades": target_grades or [],
            "description": target_desc,
            "extracurricular_programs": None,
            "learning_models": None,
            "teaching_style": None,
            "open_enrollment": None,
            "open_enrollment_grades": None,
            "base_tuition": None,
            "is_active": report.overall_score > 0,
        }
        for r in report.recommendations:
            f_name = r.field
            rec_val = r.recommended
            if rec_val is not None and rec_val != "":
                if f_name == "type" and isinstance(rec_val, str):
                    rec_val = [rec_val]
                post_ingestion_record[f_name] = rec_val

        target_prod_id = (
            staging_school.production_school_id
            if staging_school
            else (school.id if school else None)
        )
        target_staging_id = staging_school.id if staging_school else None

        # Supersede any previous unapplied outputs for this school
        if target_staging_id:
            db.query(MetadataAgentOutputModel).filter(
                MetadataAgentOutputModel.staging_school_id == target_staging_id,
                MetadataAgentOutputModel.applied_to_school == False,
            ).update({"applied_to_school": True, "verification_status": "superseded"})
        elif target_prod_id:
            db.query(MetadataAgentOutputModel).filter(
                MetadataAgentOutputModel.school_id == target_prod_id,
                MetadataAgentOutputModel.applied_to_school == False,
            ).update({"applied_to_school": True, "verification_status": "superseded"})

        metadata_output = MetadataAgentOutputModel(
            school_id=target_prod_id,
            staging_school_id=target_staging_id,
            batch_id=UUID(str(batch_id))
            if batch_id
            else (staging_school.batch_id if staging_school else None),
            job_id=active_job_id,
            agent_version="1.2.0",
            model_name="gpt-6-luna",
            overall_score=report.overall_score,
            verification_status="needs_review" if report.overall_score > 0 else "invalid",
            extracted_fields=post_ingestion_record,
            recommendations=[
                r.model_dump() if hasattr(r, "model_dump") else dict(r)
                for r in report.recommendations
            ],
            pages_crawled_count=len(plan.selected_urls) if "plan" in locals() else 1,
            applied_to_school=False,
        )
        db.add(metadata_output)
        db.flush()

        # Persist evidence records with citations and raw text snippets
        fallback_url = website_url or "https://unknown"
        for rec in report.recommendations:
            for src in rec.sources:
                evidence = EvidenceRecordModel(
                    job_id=active_job_id,
                    school_id=target_prod_id,
                    staging_school_id=target_staging_id,
                    metadata_output_id=metadata_output.id,
                    field_name=rec.field,
                    raw_value=str(rec.recommended),
                    source_url=src.url or fallback_url,
                    source_name=src.page or "Official School Website",
                    source_tier="Tier 1 - Official School Website",
                    source_type="Official Portal",
                    raw_extracted_text=src.text,
                    confidence_score=float(rec.confidence),
                    extracted_at=datetime.now(UTC),
                )
                db.add(evidence)

        # Log or update CrawlJobModel
        existing_job = db.query(CrawlJobModel).filter(CrawlJobModel.id == active_job_id).first()
        entity_id_str = str(staging_school.id) if staging_school else str(school.id)

        if not existing_job:
            job = CrawlJobModel(
                id=active_job_id,
                school_id=entity_id_str,
                status="Completed",
                current_step="finished",
                pages_crawled=1,
                evidence_count=len(report.recommendations),
                conflict_count=0,
                created_at=datetime.now(UTC),
                completed_at=datetime.now(UTC),
            )
            db.add(job)
        else:
            existing_job.status = "Completed"
            existing_job.current_step = "finished"
            existing_job.pages_crawled = (existing_job.pages_crawled or 0) + 1
            existing_job.evidence_count = (existing_job.evidence_count or 0) + len(
                report.recommendations
            )
            existing_job.completed_at = datetime.now(UTC)

        db.commit()
        return report


# Global instance
audit_service = SchoolAuditService()
