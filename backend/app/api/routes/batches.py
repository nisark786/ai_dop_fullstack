"""FastAPI endpoints for Batch Management and Intake (FR-3.1 to FR-3.6)."""

import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.schemas.agent_dispatch import AgentDispatchResponse, RunMetadataAgentRequest
from app.schemas.batch import (
    AddBatchSchoolRequest,
    BatchConfirmCreateRequest,
    BatchDetailResponse,
    BatchDetailSchoolItem,
    BatchSummaryItem,
    BatchUpdateRequest,
    BatchUploadPreviewResponse,
    BulkDropSchoolsRequest,
    BulkDropSchoolsResponse,
    PurgeTrashResponse,
)
from app.services.agents.batch_agent_worker import run_batch_metadata_worker
from app.services.batches import BatchService, TemplateGenerator

_run_batch_metadata_worker = run_batch_metadata_worker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batches", tags=["Batches"])


@router.get("", response_model=list[BatchSummaryItem])
def list_batches(
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_database_session),
):
    """List batches with optional status filtering and pagination."""
    return BatchService.list_batches(
        db, status=status_filter, search=search, limit=limit, offset=offset
    )


@router.post("/upload-preview", response_model=BatchUploadPreviewResponse)
async def upload_batch_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_database_session),
):
    """Upload Excel/CSV and receive a validation preview with duplicate detection."""
    contents = await file.read()
    try:
        return BatchService.generate_upload_preview(contents, file.filename or "intake.xlsx", db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/upload-confirm", response_model=BatchDetailResponse, status_code=status.HTTP_201_CREATED
)
def confirm_batch_creation(
    payload: BatchConfirmCreateRequest,
    db: Session = Depends(get_database_session),
):
    """Confirm validated rows, resolve duplicates, and create the batch."""
    try:
        # created_by defaults to "operator" until JWT auth lands in Milestone 8
        return BatchService.confirm_and_create_batch(db, payload, created_by="operator")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error in confirm_batch_creation")
        raise HTTPException(status_code=500, detail="Internal server error. Please retry.") from e


@router.get("/template")
def download_excel_template():
    """Download standardized Excel template for batch school intake."""
    file_bytes = TemplateGenerator.create_intake_template()
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=schoolpath_batch_intake_template.xlsx"
        },
    )


@router.get("/trash", response_model=list[BatchSummaryItem])
def list_trash_batches(
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_database_session),
):
    """List soft-deleted batches currently quarantined in the Trash Bucket."""
    return BatchService.list_trash_batches(db, search=search, limit=limit, offset=offset)


@router.post("/trash/purge-expired", response_model=PurgeTrashResponse)
def purge_expired_trash(
    retention_days: int = Query(30, ge=1),
    db: Session = Depends(get_database_session),
):
    """Purge batches that have been in the Trash Bucket longer than the retention window."""
    purged_count = BatchService.purge_expired_trash(db, retention_days=retention_days)
    return PurgeTrashResponse(
        purged_count=purged_count,
        message=f"Successfully purged {purged_count} expired batches from Trash.",
    )


@router.get("/{batch_id}", response_model=BatchDetailResponse)
def get_batch_detail(
    batch_id: str,
    db: Session = Depends(get_database_session),
):
    """Get full batch detail, member schools, and product progress matrix."""
    try:
        return BatchService.get_batch_detail(db, batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.patch("/{batch_id}", response_model=BatchSummaryItem)
def update_batch(
    batch_id: str,
    payload: BatchUpdateRequest,
    db: Session = Depends(get_database_session),
):
    """Update batch name and description."""
    try:
        return BatchService.update_batch(db, batch_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{batch_id}", response_model=BatchSummaryItem)
def soft_delete_batch(
    batch_id: str,
    db: Session = Depends(get_database_session),
):
    """Soft-delete a batch, moving it to the 30-day Trash Bucket."""
    try:
        return BatchService.soft_delete_batch(db, batch_id)
    except ValueError as e:
        msg = str(e)
        if "actively running" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg) from e
        raise HTTPException(status_code=404, detail=msg) from e


@router.post("/{batch_id}/restore", response_model=BatchSummaryItem)
def restore_batch(
    batch_id: str,
    db: Session = Depends(get_database_session),
):
    """Restore a soft-deleted batch from the Trash Bucket."""
    try:
        return BatchService.restore_batch(db, batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{batch_id}/permanent")
def permanent_delete_batch(
    batch_id: str,
    db: Session = Depends(get_database_session),
):
    """Permanently delete a batch from the database."""
    try:
        return BatchService.permanent_delete_batch(db, batch_id)
    except ValueError as e:
        msg = str(e)
        if "actively running" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg) from e
        raise HTTPException(status_code=404, detail=msg) from e


@router.post(
    "/{batch_id}/schools",
    response_model=BatchDetailSchoolItem,
    status_code=status.HTTP_201_CREATED,
)
def add_school_to_batch(
    batch_id: str,
    payload: AddBatchSchoolRequest,
    db: Session = Depends(get_database_session),
):
    """Add a school (either linking existing or creating new) to the specified batch."""
    try:
        return BatchService.add_school_to_batch(db, batch_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error in add_school_to_batch")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.delete("/{batch_id}/schools/{school_id}")
def drop_school_from_batch(
    batch_id: str,
    school_id: str,
    db: Session = Depends(get_database_session),
):
    """Drop (remove) a school's membership from the specified batch."""
    try:
        return BatchService.drop_school_from_batch(db, batch_id, school_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error in drop_school_from_batch")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post(
    "/{batch_id}/schools/bulk-drop",
    response_model=BulkDropSchoolsResponse,
)
def bulk_drop_schools_from_batch(
    batch_id: str,
    payload: BulkDropSchoolsRequest,
    db: Session = Depends(get_database_session),
):
    """Drop multiple schools from a batch in a single atomic transaction."""
    try:
        return BatchService.bulk_drop_schools(db, batch_id, payload.school_ids)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error in bulk_drop_schools_from_batch")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post(
    "/{batch_id}/run-metadata-agent",
    response_model=AgentDispatchResponse,
    summary="Dispatch School Profile & Metadata Agent across batch schools",
)
def run_metadata_agent_on_batch(
    batch_id: str,
    payload: RunMetadataAgentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database_session),
):
    """Triggers the School Profile & Metadata Agent (gpt-6-luna + Firecrawl + Tavily)

    across single, group, or whole-batch schools.
    """
    import time
    from datetime import UTC, datetime
    from uuid import UUID

    from app.models.batch import BatchModel, BatchSchoolModel
    from app.models.pipeline import CrawlJobModel
    from app.models.staging_school import StagingSchoolModel

    batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found.")

    if payload.scope == "single":
        target_ids = [str(payload.school_ids[0])]
    elif payload.scope == "group":
        target_ids = [str(sid) for sid in payload.school_ids]
    else:  # whole batch
        stagings = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .all()
        )
        if stagings:
            target_ids = [str(s.id) for s in stagings]
        else:
            batch_schools = (
                db.query(BatchSchoolModel).filter(BatchSchoolModel.batch_id == batch_id).all()
            )
            target_ids = [str(bs.school_id) for bs in batch_schools]

    if not target_ids:
        raise HTTPException(status_code=400, detail="No schools found in scope to execute.")

    job_id = f"JOB-{int(time.time() * 1000) % 100000}"

    # Mark schools as queued
    for sid in target_ids:
        staging = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.id == UUID(sid),
            )
            .first()
        )
        if staging:
            meta = dict(staging.metadata_json or {})
            products = dict(meta.get("products") or {})
            products["info"] = {
                "status": "queued",
                "job_id": job_id,
                "queued_at": datetime.now(UTC).isoformat(),
            }
            meta["products"] = products
            staging.metadata_json = meta
        else:
            bs = (
                db.query(BatchSchoolModel)
                .filter(
                    BatchSchoolModel.batch_id == batch_id,
                    BatchSchoolModel.school_id == UUID(sid),
                )
                .first()
            )
            if bs:
                meta = dict(bs.metadata_json or {})
                products = dict(meta.get("products") or {})
                products["info"] = {
                    "status": "queued",
                    "job_id": job_id,
                    "queued_at": datetime.now(UTC).isoformat(),
                }
                meta["products"] = products
                bs.metadata_json = meta

    batch.status = "processing"
    batch.updated_at = datetime.now(UTC)

    # Create initial CrawlJobModel record for Job Monitor
    new_job = CrawlJobModel(
        id=job_id,
        school_id=target_ids[0] if len(target_ids) == 1 else "batch_scope",
        status="Running",
        current_step="queued",
        pages_crawled=0,
        evidence_count=0,
        conflict_count=0,
        created_at=datetime.now(UTC),
    )
    db.add(new_job)
    db.commit()

    # Queue background execution
    background_tasks.add_task(
        _run_batch_metadata_worker,
        batch_id,
        target_ids,
        job_id,
        payload.force_refresh,
        payload.workers,
    )

    return AgentDispatchResponse(
        job_id=job_id,
        batch_id=batch_id,
        agent_id="SchoolProfileAgent",
        product_name="School Info (Metadata)",
        target_count=len(target_ids),
        status="queued",
        message=f"Job {job_id} queued for {len(target_ids)} school(s) in {batch.name}.",
    )
