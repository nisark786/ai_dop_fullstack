"""Crawl job routes — aligned with the canonical crawl_jobs database table."""

import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.job import CrawlJobModel
from app.schemas.job import CrawlJobResponse, JobCreateRequest, JobStartResponse

router = APIRouter(prefix="/jobs", tags=["Crawl Jobs"])


@router.get(
    "", response_model=list[CrawlJobResponse], summary="List all crawler jobs from database"
)
def list_jobs(
    limit: int = Query(50, ge=1, le=200, description="Maximum records to return"),
    db: Session = Depends(get_database_session),
) -> list[CrawlJobResponse]:
    jobs = db.query(CrawlJobModel).order_by(CrawlJobModel.created_at.desc()).limit(limit).all()
    return [CrawlJobResponse.model_validate(j) for j in jobs]


@router.post(
    "/start",
    response_model=JobStartResponse,
    summary="Start a new crawl extraction job",
)
def start_crawl_job(
    payload: JobCreateRequest,
    db: Session = Depends(get_database_session),
) -> JobStartResponse:
    job_id = f"JOB-{int(time.time() * 1000) % 100000}"
    new_job = CrawlJobModel(
        id=job_id,
        school_id=payload.school_id,
        agent_name=payload.agent_name,
        product_name=payload.product_name,
        status="queued",
        current_step="init",
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return JobStartResponse(
        job_id=job_id,
        message=f"Job {job_id} queued successfully",
        status="queued",
    )


@router.post("/{job_id}/retry", response_model=JobStartResponse, summary="Retry a failed job")
def retry_job(job_id: str, db: Session = Depends(get_database_session)) -> JobStartResponse:
    job = db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "queued"
    job.error_message = None
    job.current_step = "init"
    db.commit()
    return JobStartResponse(
        job_id=job_id,
        message=f"Job {job_id} re-queued successfully",
        status="queued",
    )
