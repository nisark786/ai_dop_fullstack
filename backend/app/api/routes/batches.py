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
    PurgeTrashResponse,
)
from app.services.batches import BatchService, TemplateGenerator

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
        raise HTTPException(status_code=404, detail=str(e)) from e


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
        raise HTTPException(status_code=404, detail=str(e)) from e


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


def _run_batch_metadata_worker(
    batch_id: str,
    school_ids: list[str],
    job_id: str,
    force_refresh: bool = False,
    workers: int = 1,
):
    """Background worker executing the School Metadata Agent across target batch schools.

    Supports concurrent thread execution (1 to 5 workers) with thread-safe global
    rate limiting for Firecrawl (6.0s) and Tavily (1.5s), plus pause/cancel checking.
    """
    import concurrent.futures
    from datetime import UTC, datetime
    from uuid import UUID

    from app.core.database import DatabaseSessionFactory
    from app.models.batch import BatchModel, BatchSchoolModel
    from app.models.pipeline import CrawlJobModel
    from app.models.staging_school import StagingSchoolModel
    from app.pipelines.audit_crawler.audit_service import audit_service

    def _is_job_halted() -> bool:
        with DatabaseSessionFactory() as check_db:
            job = check_db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
            if job and job.status in ("Paused", "paused", "Cancelled", "cancelled"):
                return True
            batch = check_db.query(BatchModel).filter(BatchModel.id == batch_id).first()
            if batch and batch.status in ("paused", "trashed"):
                return True
        return False

    def _process_single_school(sid: str) -> bool:
        if _is_job_halted():
            return False

        with DatabaseSessionFactory() as thread_db:
            staging = None
            bs = None
            try:
                # Mark as running on staging school or legacy fallback
                staging = (
                    thread_db.query(StagingSchoolModel)
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
                        "status": "running",
                        "job_id": job_id,
                        "started_at": datetime.now(UTC).isoformat(),
                    }
                    meta["products"] = products
                    staging.metadata_json = meta
                    staging.status = "crawling"
                    thread_db.commit()
                else:
                    bs = (
                        thread_db.query(BatchSchoolModel)
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
                            "status": "running",
                            "job_id": job_id,
                            "started_at": datetime.now(UTC).isoformat(),
                        }
                        meta["products"] = products
                        bs.metadata_json = meta
                        thread_db.commit()

                report = audit_service.audit_single_school(
                    sid,
                    thread_db,
                    job_id=job_id,
                    batch_id=batch_id,
                    force_refresh=force_refresh,
                )

                if staging:
                    staging = (
                        thread_db.query(StagingSchoolModel)
                        .filter(StagingSchoolModel.id == UUID(sid))
                        .first()
                    )
                    if staging:
                        meta = dict(staging.metadata_json or {})
                        products = dict(meta.get("products") or {})
                        existing_info = products.get("info") or {}
                        started_at_str = existing_info.get("started_at")
                        final_status = "needs_verification"
                        products["info"] = {
                            "status": "needs_review",
                            "score": report.overall_score,
                            "job_id": job_id,
                            "started_at": started_at_str,
                            "completed_at": datetime.now(UTC).isoformat(),
                            "recommendations": [r.model_dump() for r in report.recommendations],
                        }
                        meta["products"] = products
                        staging.metadata_json = meta
                        staging.status = final_status
                        thread_db.commit()
                elif bs:
                    bs = (
                        thread_db.query(BatchSchoolModel)
                        .filter(
                            BatchSchoolModel.batch_id == batch_id,
                            BatchSchoolModel.school_id == UUID(sid),
                        )
                        .first()
                    )
                    if bs:
                        meta = dict(bs.metadata_json or {})
                        products = dict(meta.get("products") or {})
                        existing_info = products.get("info") or {}
                        started_at_str = existing_info.get("started_at")
                        final_status = "verified" if report.overall_score >= 75 else "needs_review"
                        products["info"] = {
                            "status": final_status,
                            "score": report.overall_score,
                            "job_id": job_id,
                            "started_at": started_at_str,
                            "completed_at": datetime.now(UTC).isoformat(),
                            "recommendations": [r.model_dump() for r in report.recommendations],
                        }
                        meta["products"] = products
                        bs.metadata_json = meta
                        bs.status = final_status
                        thread_db.commit()

                # Increment crawl job pages crawled
                cj = thread_db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
                if cj:
                    cj.pages_crawled = (cj.pages_crawled or 0) + 1
                    thread_db.commit()

                return True

            except Exception as school_err:
                logger.error("Error auditing school %s in batch %s: %s", sid, batch_id, school_err)
                staging = (
                    thread_db.query(StagingSchoolModel)
                    .filter(StagingSchoolModel.id == UUID(sid))
                    .first()
                )
                if staging:
                    meta = dict(staging.metadata_json or {})
                    products = dict(meta.get("products") or {})
                    products["info"] = {
                        "status": "failed",
                        "error": str(school_err),
                        "job_id": job_id,
                    }
                    meta["products"] = products
                    staging.metadata_json = meta
                    staging.status = "failed"
                    thread_db.commit()
                elif bs:
                    bs = (
                        thread_db.query(BatchSchoolModel)
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
                            "status": "failed",
                            "error": str(school_err),
                            "job_id": job_id,
                        }
                        meta["products"] = products
                        bs.metadata_json = meta
                        thread_db.commit()
                return False

    concurrency = max(1, min(int(workers or 1), 5))

    if concurrency == 1:
        for sid in school_ids:
            if _is_job_halted():
                break
            _process_single_school(sid)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = []
            for sid in school_ids:
                if _is_job_halted():
                    break
                futures.append(executor.submit(_process_single_school, sid))
            for future in concurrent.futures.as_completed(futures):
                try:
                    future.result()
                except Exception as exc:
                    logger.error("Worker execution error: %s", exc)

    # Post-execution status reconciliation
    with DatabaseSessionFactory() as final_db:
        job = final_db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
        batch = final_db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if batch:
            if job and job.status in ("Paused", "paused"):
                batch.status = "paused"
            elif job and job.status in ("Cancelled", "cancelled"):
                batch.status = "ready"
            else:
                batch.status = "ready"
                if job and job.status == "Running":
                    job.status = "Completed"
                    job.completed_at = datetime.now(UTC)
            batch.updated_at = datetime.utcnow()
            final_db.commit()


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
            db.query(StagingSchoolModel).filter(StagingSchoolModel.batch_id == batch_id).all()
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
    batch.updated_at = datetime.utcnow()

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
