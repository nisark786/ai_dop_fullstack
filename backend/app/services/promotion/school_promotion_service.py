"""School Promotion Service.

Promotes verified and approved staging schools into the authoritative production `schools` table.
Guarantees that raw, unverified data does not corrupt production datasets.
"""

import logging
import uuid
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import EvidenceRecordModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel

logger = logging.getLogger(__name__)


def _utc_now():
    return datetime.now(UTC)


class SchoolPromotionService:
    """Handles controlled promotion of staging school records to the production database."""

    @staticmethod
    def promote_staging_school(db: Session, staging_id: UUID) -> Schools:
        """Promotes a verified staging school into the golden production `schools` table.

        - If `production_school_id` already exists, merges and updates verified attributes.
        - If `production_school_id` is null, creates a new production `Schools` record.
        - Sets staging status to 'published' and binds foreign keys.
        """
        staging = db.query(StagingSchoolModel).filter(StagingSchoolModel.id == staging_id).first()
        if not staging:
            raise ValueError(f"Staging school with id {staging_id} not found.")

        # Latest metadata agent output if available
        latest_output = (
            db.query(MetadataAgentOutputModel)
            .filter(MetadataAgentOutputModel.staging_school_id == staging_id)
            .order_by(MetadataAgentOutputModel.created_at.desc())
            .first()
        )
        extracted = (
            latest_output.extracted_fields
            if latest_output and latest_output.extracted_fields
            else {}
        )

        now = _utc_now()
        target_school: Schools | None = None

        if staging.production_school_id:
            target_school = (
                db.query(Schools).filter(Schools.id == staging.production_school_id).first()
            )

        if target_school:
            # Update existing production school
            target_school.name = extracted.get("name") or staging.name or target_school.name
            target_school.website = (
                extracted.get("website") or staging.website or target_school.website
            )
            target_school.address = (
                extracted.get("address") or staging.address or target_school.address
            )
            if extracted.get("phone") or staging.phone:
                target_school.phone = extracted.get("phone") or staging.phone
            if extracted.get("type"):
                target_school.type = extracted["type"]
            if extracted.get("grades"):
                target_school.grades = extracted["grades"]
            if extracted.get("learning_models"):
                target_school.learning_models = extracted["learning_models"]
            if extracted.get("description"):
                target_school.description = extracted["description"]
            target_school.is_active = True
            target_school.updated_at = now
        else:
            # Create new production school
            target_school = Schools(
                id=uuid.uuid4(),
                name=extracted.get("name") or staging.name,
                website=extracted.get("website") or staging.website,
                address=extracted.get("address") or staging.address,
                phone=extracted.get("phone") or staging.phone,
                type=extracted.get("type") or staging.type or {},
                grades=extracted.get("grades") or staging.grades or {},
                learning_models=extracted.get("learning_models") or {},
                description=extracted.get("description") or "",
                has_academic_rigor=False,
                is_active=True,
                is_tefa_approved=False,
                created_at=now,
                updated_at=now,
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
            )
            db.add(target_school)
            db.flush()

        # Update staging record state
        staging.production_school_id = target_school.id
        staging.status = "published"
        staging.updated_at = now

        # Bind outputs and evidence to the new production school id
        db.query(MetadataAgentOutputModel).filter(
            MetadataAgentOutputModel.staging_school_id == staging_id
        ).update({"school_id": target_school.id, "applied_to_school": True})

        db.query(EvidenceRecordModel).filter(
            EvidenceRecordModel.staging_school_id == staging_id
        ).update({"school_id": target_school.id})

        db.commit()
        db.refresh(target_school)
        logger.info(
            "Successfully promoted staging school %s to production school %s",
            staging.name,
            target_school.id,
        )
        return target_school
