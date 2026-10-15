"""Published golden records endpoint — queries real approved resolved values from the DB."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.pipeline import ResolvedValueModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.schemas.published import PublishedRecordResponse

router = APIRouter(prefix="/published", tags=["Published Data"])


@router.get(
    "",
    response_model=list[PublishedRecordResponse],
    summary="Fetch approved golden records from resolved_values table",
)
def get_published_records(
    db: Session = Depends(get_database_session),
) -> list[PublishedRecordResponse]:
    """
    Returns records from resolved_values where review_status == 'approved'.
    Returns an empty list when no approved records exist — never returns synthetic data.
    """
    records = (
        db.query(ResolvedValueModel)
        .filter(ResolvedValueModel.review_status == "approved")
        .order_by(ResolvedValueModel.resolved_at.desc())
        .limit(200)
        .all()
    )

    results: list[PublishedRecordResponse] = []
    for r in records:
        school_name = "Unknown School"
        district_name = None
        staging_id_str = None
        sandbox_sync_data = None
        try:
            school_uuid = UUID(r.school_id)
            school = db.query(Schools).filter(Schools.id == school_uuid).first()
            if school:
                school_name = school.name
                district_name = getattr(school, "district_name", None)

            # Query staging record to obtain sandbox sync provenance
            staging = (
                db.query(StagingSchoolModel)
                .filter(
                    (StagingSchoolModel.production_school_id == school_uuid)
                    | (StagingSchoolModel.id == school_uuid)
                )
                .first()
            )
            if staging:
                staging_id_str = str(staging.id)
                if staging.metadata_json and "sandbox_sync" in staging.metadata_json:
                    sandbox_sync_data = staging.metadata_json["sandbox_sync"]
        except Exception:
            pass

        results.append(
            PublishedRecordResponse(
                id=r.id,
                school_id=r.school_id,
                staging_school_id=staging_id_str,
                school_name=school_name,
                district=district_name,
                product=r.field_name,
                field_name=r.field_name,
                verified_value=r.chosen_value or "",
                confidence_score=r.consensus_score,
                published_at=r.resolved_at.strftime("%Y-%m-%d %H:%M")
                if isinstance(r.resolved_at, datetime)
                else str(r.resolved_at or ""),
                sandbox_sync=sandbox_sync_data,
            )
        )
    return results
