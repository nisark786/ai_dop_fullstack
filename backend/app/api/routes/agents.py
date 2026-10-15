"""FastAPI endpoints for AI Agent Registry, Multi-Agent Batch Execution, and Live Job Monitoring."""

import logging
import time
from contextlib import suppress
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.batch import BatchModel, BatchSchoolModel
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.pipeline import CrawlJobModel
from app.models.staging_school import StagingSchoolModel
from app.schemas.agent_dispatch import AgentDispatchResponse
from app.schemas.agents import (
    AgentJobSummary,
    AgentRegistryItem,
    JobActionResponse,
    RunAgentsForBatchRequest,
    RunAgentsForBatchResponse,
)
from app.services.agents.batch_agent_worker import run_batch_metadata_worker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["AI Agents"])

# Canonical registry of all platform data product agents (FRD FR-4.1 - FR-4.5)
AGENT_REGISTRY: list[AgentRegistryItem] = [
    AgentRegistryItem(
        product_key="info",
        product_name="School Profile & Metadata",
        agent_id="metadata_agent_v1",
        agent_name="Metadata Discovery & Quality Audit Agent",
        version="1.2.0",
        status="active",
        is_implemented=True,
        description="Extracts canonical school identity, address, contact details, grade offerings, enrollment status, and instructional learning models.",
        target_fields=[
            "name",
            "grades",
            "address",
            "full_address",
            "website",
            "phone",
            "email",
            "description",
            "open_enrollment",
            "extracurricular_programs",
            "learning_models",
        ],
        model_name="gpt-6-luna",
        dispatch_endpoint="/api/batches/{id}/run-metadata-agent",
    ),
]


@router.get(
    "/registry",
    response_model=list[AgentRegistryItem],
    summary="List all registered data product agents and implementation readiness",
)
def get_agent_registry():
    """Returns the full catalog of data product agents (FRD FR-4.1)."""
    return AGENT_REGISTRY


@router.post(
    "/run-for-batch",
    response_model=RunAgentsForBatchResponse,
    summary="Dispatch one or more agents against one or more batches of schools",
)
def run_agents_for_batch(
    payload: RunAgentsForBatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_database_session),
):
    """Orchestrates agent execution across one or more target school batches.

    Dispatches active agents (like Metadata Agent) and safely skips unimplemented agents.
    """
    dispatched: list[AgentDispatchResponse] = []
    skipped: list[str] = []

    # Map of implemented agents
    implemented_map = {reg.product_key: reg for reg in AGENT_REGISTRY if reg.is_implemented}

    for b_id in payload.batch_ids:
        batch_id_str = str(b_id)
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id_str).first()
        if not batch:
            continue

        if payload.scope == "single":
            target_ids = [str(payload.school_ids[0])]
        elif payload.scope == "group":
            target_ids = [str(sid) for sid in payload.school_ids]
        else:  # entire batch
            stagings = (
                db.query(StagingSchoolModel)
                .filter(
                    StagingSchoolModel.batch_id == batch_id_str,
                    StagingSchoolModel.deleted_at.is_(None),
                )
                .all()
            )
            if stagings:
                # If not forcing refresh, smart-skip already verified schools
                if not payload.force_refresh:
                    uncompleted = [
                        s for s in stagings if s.status not in ("needs_verification", "verified")
                    ]
                    if uncompleted:
                        stagings = uncompleted
                target_ids = [str(s.id) for s in stagings]
            else:
                batch_schools = (
                    db.query(BatchSchoolModel)
                    .filter(BatchSchoolModel.batch_id == batch_id_str)
                    .all()
                )
                target_ids = [str(bs.school_id) for bs in batch_schools]

        if not target_ids:
            continue

        for key in payload.agent_keys:
            if key not in implemented_map:
                if key not in skipped:
                    skipped.append(key)
                continue

            reg = implemented_map[key]
            if key == "info":
                job_id = f"JOB-{int(time.time() * 1000) % 100000}"

                # Mark schools as queued
                for sid in target_ids:
                    staging = (
                        db.query(StagingSchoolModel)
                        .filter(
                            StagingSchoolModel.batch_id == batch_id_str,
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
                                BatchSchoolModel.batch_id == batch_id_str,
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

                # Create CrawlJobModel record using valid DB columns
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

                # Dispatch background worker with configurable concurrency
                background_tasks.add_task(
                    run_batch_metadata_worker,
                    batch_id_str,
                    target_ids,
                    job_id,
                    payload.force_refresh,
                    payload.workers,
                )

                dispatched.append(
                    AgentDispatchResponse(
                        job_id=job_id,
                        batch_id=batch_id_str,
                        agent_id=reg.agent_id,
                        product_name=reg.product_name,
                        target_count=len(target_ids),
                        status="queued",
                        message=f"Queued {len(target_ids)} schools in '{batch.name}' for {reg.product_name} execution with {reg.model_name} ({payload.workers} workers).",
                    )
                )

    msg = f"Dispatched {len(dispatched)} agent job(s) across {len(payload.batch_ids)} batch(es)."
    if skipped:
        msg += f" Skipped {len(skipped)} agent(s) pending Phase 2 implementation ({', '.join(skipped)})."

    return RunAgentsForBatchResponse(
        dispatched=dispatched,
        skipped=skipped,
        message=msg,
    )


@router.get(
    "/jobs",
    response_model=list[AgentJobSummary],
    summary="Get real-time agent execution progress and jobs for batches",
)
def get_agent_jobs(
    batch_ids: list[UUID] | None = Query(None, description="Optional batch IDs to filter jobs"),
    batch_id: UUID | None = Query(None, description="Legacy single batch ID parameter"),
    status: Literal["pending", "running", "completed", "failed"] | None = Query(
        None, description="Filter by operational status"
    ),
    db: Session = Depends(get_database_session),
):
    """Returns real-time execution progress computed from batch schools metadata (FR-7.1 - FR-7.4)."""
    target_batch_ids: list[UUID] = list(batch_ids or [])
    if batch_id and batch_id not in target_batch_ids:
        target_batch_ids.append(batch_id)

    summaries: list[AgentJobSummary] = []

    if not target_batch_ids:
        # Default to all active non-trashed batches
        active_batches = db.query(BatchModel).filter(BatchModel.status != "trashed").all()
        target_batch_ids = [UUID(str(b.id)) for b in active_batches]

    for b_id in target_batch_ids:
        batch_id_str = str(b_id)
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id_str).first()
        if not batch:
            continue

        staging_schools = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id_str,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .all()
        )
        total_schools = len(staging_schools)
        schools_list = staging_schools
        if total_schools == 0:
            batch_schools = (
                db.query(BatchSchoolModel).filter(BatchSchoolModel.batch_id == batch_id_str).all()
            )
            total_schools = len(batch_schools)
            schools_list = batch_schools

        if total_schools > 0:
            completed = 0
            running = 0
            queued = 0
            failed = 0
            latest_job_id = None
            started_at: datetime | None = None
            finished_at: datetime | None = None

            for bs in schools_list:
                meta = bs.metadata_json or {}
                products = meta.get("products") or {}
                info_stat = products.get("info") or {}
                st = info_stat.get("status")
                jid = info_stat.get("job_id")
                if jid:
                    latest_job_id = jid

                if st in ("verified", "needs_review", "needs_verification"):
                    completed += 1
                elif st == "running":
                    running += 1
                elif st == "queued":
                    queued += 1
                elif st == "failed":
                    failed += 1

                if not started_at and info_stat.get("started_at"):
                    with suppress(Exception):
                        started_at = datetime.fromisoformat(info_stat["started_at"])
                if not finished_at and info_stat.get("completed_at"):
                    with suppress(Exception):
                        finished_at = datetime.fromisoformat(info_stat["completed_at"])

            # If started_at wasn't in metadata_json, look up the crawl job
            crawl_job = None
            if latest_job_id:
                crawl_job = (
                    db.query(CrawlJobModel).filter(CrawlJobModel.id == latest_job_id).first()
                )
                if not started_at and crawl_job and crawl_job.created_at:
                    started_at = crawl_job.created_at

            if started_at and started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=UTC)
            if finished_at and finished_at.tzinfo is None:
                finished_at = finished_at.replace(tzinfo=UTC)

            # Determine composite job status (honoring paused & cancelled states)
            if batch.status == "paused" or (crawl_job and crawl_job.status in ("Paused", "paused")):
                job_status = "paused"
            elif crawl_job and crawl_job.status in ("Cancelled", "cancelled"):
                job_status = "cancelled"
            elif running > 0:
                # Self-healing stale detection: if running school hasn't had activity in > 15m
                if (
                    started_at
                    and (datetime.now(UTC) - started_at).total_seconds() > 900
                    and (not crawl_job or crawl_job.status != "Running")
                ):
                    job_status = "failed"
                else:
                    job_status = "running"
            elif queued > 0:
                job_status = "pending"
            elif completed > 0 and (completed + failed) == total_schools:
                job_status = "completed" if failed == 0 else "failed"
            elif completed > 0:
                job_status = "running"
            elif failed > 0:
                job_status = "failed"
            else:
                job_status = "pending"

            has_run = (
                latest_job_id is not None
                or running > 0
                or queued > 0
                or completed > 0
                or failed > 0
            )

            if not has_run:
                continue

            elapsed_seconds: float | None = None
            if started_at:
                end_time = finished_at or datetime.now(UTC)
                elapsed_seconds = max(0.0, (end_time - started_at).total_seconds())

            if status is None or job_status == status:
                summaries.append(
                    AgentJobSummary(
                        job_id=latest_job_id or f"BATCH-{batch_id_str[:8]}",
                        batch_id=batch_id_str,
                        product_key="info",
                        product_name=f"Metadata • {batch.name}",
                        agent_id="metadata_agent_v1",
                        status=job_status,
                        target_count=total_schools,
                        completed_count=completed,
                        failed_count=failed,
                        started_at=started_at,
                        finished_at=finished_at,
                        elapsed_seconds=elapsed_seconds,
                    )
                )

    return summaries


def _resolve_batch_for_job(
    db: Session,
    job_id: str,
    batch_id: UUID | None = None,
) -> BatchModel:
    """Precisely resolves the single target batch belonging to a job_id without affecting other batches."""
    if batch_id:
        batch = db.query(BatchModel).filter(BatchModel.id == str(batch_id)).first()
        if batch:
            return batch

    # Check MetadataAgentOutputModel for associated batch_id
    output = (
        db.query(MetadataAgentOutputModel)
        .filter(
            MetadataAgentOutputModel.job_id == job_id,
            MetadataAgentOutputModel.batch_id.is_not(None),
        )
        .first()
    )
    if output and output.batch_id:
        batch = db.query(BatchModel).filter(BatchModel.id == str(output.batch_id)).first()
        if batch:
            return batch

    # Check StagingSchoolModel in active/paused batches
    active_batches = (
        db.query(BatchModel).filter(BatchModel.status.in_(["processing", "paused", "ready"])).all()
    )
    for b in active_batches:
        stagings = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == str(b.id),
                StagingSchoolModel.deleted_at.is_(None),
            )
            .all()
        )
        for s in stagings:
            meta = s.metadata_json or {}
            products = meta.get("products") or {}
            info_stat = products.get("info") or {}
            if info_stat.get("job_id") == job_id:
                return b

    # Check legacy BatchSchoolModel
    for b in active_batches:
        bs_list = db.query(BatchSchoolModel).filter(BatchSchoolModel.batch_id == str(b.id)).all()
        for bs in bs_list:
            meta = bs.metadata_json or {}
            products = meta.get("products") or {}
            info_stat = products.get("info") or {}
            if info_stat.get("job_id") == job_id:
                return b

    # Fallback to the latest processing/paused batch if any
    fallback = (
        db.query(BatchModel)
        .filter(BatchModel.status.in_(["processing", "paused"]))
        .order_by(BatchModel.updated_at.desc())
        .first()
    )
    if fallback:
        return fallback

    raise HTTPException(
        status_code=404,
        detail=f"Target batch for job '{job_id}' not found.",
    )


@router.post(
    "/jobs/{job_id}/pause",
    response_model=JobActionResponse,
    summary="Pause an active agent execution job",
)
def pause_agent_job(
    job_id: str,
    batch_id: UUID | None = Query(None, description="Optional target batch ID"),
    db: Session = Depends(get_database_session),
):
    """Gracefully pauses an in-flight agent job for its target batch."""
    job = db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    target_batch = _resolve_batch_for_job(db, job_id, batch_id)

    job.status = "Paused"
    target_batch.status = "paused"
    target_batch.updated_at = datetime.now(UTC)
    db.commit()

    return JobActionResponse(
        job_id=job_id,
        batch_id=str(target_batch.id),
        status="paused",
        message=f"Job {job_id} for batch '{target_batch.name}' paused. In-flight operations will stop gracefully.",
    )


@router.post(
    "/jobs/{job_id}/resume",
    response_model=JobActionResponse,
    summary="Resume a paused or interrupted agent execution job",
)
def resume_agent_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    batch_id: UUID | None = Query(None, description="Optional target batch ID"),
    workers: int = Query(2, ge=1, le=5, description="Worker threads (1-5)"),
    db: Session = Depends(get_database_session),
):
    """Resumes execution for unverified schools in the target batch without re-crawling completed ones."""
    job = db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    target_batch = _resolve_batch_for_job(db, job_id, batch_id)
    batch_id_str = str(target_batch.id)

    stagings = (
        db.query(StagingSchoolModel)
        .filter(
            StagingSchoolModel.batch_id == batch_id_str,
            StagingSchoolModel.deleted_at.is_(None),
        )
        .all()
    )

    remaining_ids = []
    for s in stagings:
        if s.status not in ("needs_verification", "verified"):
            remaining_ids.append(str(s.id))
            if s.status == "crawling":
                s.status = "pending"

    if not remaining_ids:
        target_batch.status = "completed"
        job.status = "Completed"
        db.commit()
        return JobActionResponse(
            job_id=job_id,
            batch_id=batch_id_str,
            status="completed",
            message=f"All schools in batch '{target_batch.name}' are already verified.",
        )

    job.status = "Running"
    target_batch.status = "processing"
    target_batch.updated_at = datetime.now(UTC)
    db.commit()

    background_tasks.add_task(
        run_batch_metadata_worker,
        batch_id_str,
        remaining_ids,
        job_id,
        False,
        workers,
    )

    return JobActionResponse(
        job_id=job_id,
        batch_id=batch_id_str,
        status="running",
        message=f"Resumed execution for {len(remaining_ids)} remaining schools with {workers} worker(s).",
    )


@router.post(
    "/jobs/{job_id}/cancel",
    response_model=JobActionResponse,
    summary="Cancel a running or paused agent execution job",
)
def cancel_agent_job(
    job_id: str,
    batch_id: UUID | None = Query(None, description="Optional target batch ID"),
    db: Session = Depends(get_database_session),
):
    """Cancels a job and resets uncompleted schools in the target batch back to pending."""
    job = db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    target_batch = _resolve_batch_for_job(db, job_id, batch_id)
    batch_id_str = str(target_batch.id)

    job.status = "Cancelled"
    target_batch.status = "ready"
    target_batch.updated_at = datetime.now(UTC)

    crawling_schools = (
        db.query(StagingSchoolModel)
        .filter(
            StagingSchoolModel.batch_id == batch_id_str,
            StagingSchoolModel.status == "crawling",
        )
        .all()
    )
    for s in crawling_schools:
        s.status = "pending"
        meta = dict(s.metadata_json or {})
        if "products" in meta and "info" in meta["products"]:
            meta["products"]["info"]["status"] = "queued"
        s.metadata_json = meta

    db.commit()
    return JobActionResponse(
        job_id=job_id,
        batch_id=batch_id_str,
        status="cancelled",
        message=f"Job {job_id} for batch '{target_batch.name}' cancelled. Unfinished schools reset to pending.",
    )
