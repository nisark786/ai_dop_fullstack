"""
Background worker executing the School Metadata Agent across target batch schools.
Supports concurrent thread execution (1 to 5 workers) with thread-safe global
rate limiting for Firecrawl and Tavily, plus pause/cancel checking.
"""

import concurrent.futures
import logging
from datetime import UTC, datetime
from uuid import UUID

from app.core.database import DatabaseSessionFactory
from app.models.batch import BatchModel, BatchSchoolModel
from app.models.pipeline import CrawlJobModel
from app.models.staging_school import StagingSchoolModel
from app.pipelines.audit_crawler.audit_service import audit_service

logger = logging.getLogger(__name__)


def run_batch_metadata_worker(
    batch_id: str,
    school_ids: list[str],
    job_id: str,
    force_refresh: bool = False,
    workers: int = 1,
) -> None:
    """Executes the School Metadata Agent across target batch schools in the background."""

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
        batch_uuid = UUID(batch_id) if isinstance(batch_id, str) else batch_id
        job = final_db.query(CrawlJobModel).filter(CrawlJobModel.id == job_id).first()
        batch = final_db.query(BatchModel).filter(BatchModel.id.in_([batch_id, batch_uuid])).first()
        if batch:
            if job and job.status in ("Paused", "paused"):
                batch.status = "paused"
            elif job and job.status in ("Cancelled", "cancelled"):
                batch.status = "ready"
            else:
                # Check if all staging schools have reached a terminal/processed status
                uncompleted_count = (
                    final_db.query(StagingSchoolModel)
                    .filter(
                        StagingSchoolModel.batch_id.in_([batch_id, batch_uuid]),
                        StagingSchoolModel.deleted_at.is_(None),
                        StagingSchoolModel.status.in_(
                            ["pending", "crawling", "running", "extracting"]
                        ),
                    )
                    .count()
                )
                if uncompleted_count == 0:
                    batch.status = "completed"
                else:
                    batch.status = "ready"

                if job and job.status == "Running":
                    job.status = "Completed"
                    job.completed_at = datetime.now(UTC)
            batch.updated_at = datetime.now(UTC)
            final_db.commit()
