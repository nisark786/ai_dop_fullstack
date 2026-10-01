from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.source import SourceRegistryModel
from app.schemas.source import (
    SourceResponse,
    SourceWeightUpdateRequest,
    SourceWeightUpdateResponse,
)

router = APIRouter(prefix="/sources", tags=["Source Registry"])


@router.get(
    "",
    response_model=list[SourceResponse],
    summary="Fetch all dynamic source registry weights from database",
)
def list_sources(db: Session = Depends(get_database_session)) -> list[SourceResponse]:
    sources = db.query(SourceRegistryModel).all()
    results = []
    for s in sources:
        results.append(
            SourceResponse(
                id=s.id,
                source_name=s.source_name,
                domain_pattern=s.domain_pattern,
                category=s.category,
                configured_weight=s.configured_weight,
                effective_weight=s.effective_weight,
                approved_count=s.approved_count,
                corrected_count=s.corrected_count,
                rejected_count=s.rejected_count,
                total_reviews=s.total_reviews,
                historical_accuracy=s.historical_accuracy,
                is_active=s.is_active,
            )
        )
    return results


@router.patch(
    "/{id}/weight",
    response_model=SourceWeightUpdateResponse,
    summary="Update configured baseline weight",
)
def update_source_weight(
    id: str,
    payload: SourceWeightUpdateRequest,
    db: Session = Depends(get_database_session),
) -> SourceWeightUpdateResponse:
    source = db.query(SourceRegistryModel).filter(SourceRegistryModel.id == id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    source.configured_weight = payload.new_weight
    source.effective_weight = round(payload.new_weight * (source.historical_accuracy / 100.0), 1)
    db.commit()
    return SourceWeightUpdateResponse(
        source_id=id,
        effective_weight=source.effective_weight,
        message=f"Source {id} baseline weight updated to {payload.new_weight}",
    )
