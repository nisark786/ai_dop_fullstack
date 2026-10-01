"""Published golden records endpoint — queries real approved resolved values from the DB."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.resolved_value import ResolvedValueModel
from app.models.schools import Schools
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
        try:
            school = db.query(Schools).filter(Schools.id == UUID(r.school_id)).first()
            if school:
                school_name = school.name
                district_name = school.district_name
        except Exception:
            pass

        results.append(
            PublishedRecordResponse(
                id=r.id,
                school_id=r.school_id,
                school_name=school_name,
                district=district_name,
                product=r.field_name,
                field_name=r.field_name,
                verified_value=r.chosen_value or "",
                confidence_score=r.consensus_score,
                published_at=r.resolved_at.strftime("%Y-%m-%d %H:%M")
                if isinstance(r.resolved_at, datetime)
                else str(r.resolved_at or ""),
            )
        )
    return results
