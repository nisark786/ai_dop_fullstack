import threading
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import DatabaseSessionFactory, get_database_session
from app.models.schools import Schools
from app.pipelines.audit_crawler.audit_service import audit_service
from app.pipelines.audit_crawler.schemas import DQAReport

router = APIRouter(prefix="/pipelines/audit", tags=["Audit Pipeline"])


# Global thread-safe progress tracker for live UI dashboard
class BatchAuditProgress:
    def __init__(self):
        self._lock = threading.Lock()
        self.is_running: bool = False
        self.total: int = 0
        self.processed: int = 0
        self.reactivated: int = 0
        self.needs_review: int = 0
        self.unverified: int = 0
        self.current_school_name: str | None = None
        self.started_at: float | None = None
        self.logs: list[str] = []

    def start(self, total: int, initial_message: str | None = None) -> None:
        with self._lock:
            self.is_running = True
            self.started_at = time.time()
            self.total = total
            self.processed = 0
            self.reactivated = 0
            self.needs_review = 0
            self.unverified = 0
            self.logs = []
            if initial_message:
                timestamp = time.strftime("%H:%M:%S")
                self.logs.append(f"[{timestamp}] {initial_message}")

    def finish(self, final_message: str | None = None) -> None:
        with self._lock:
            self.is_running = False
            self.current_school_name = None
            if final_message:
                timestamp = time.strftime("%H:%M:%S")
                self.logs.append(f"[{timestamp}] {final_message}")

    def set_current_school(self, name: str) -> None:
        with self._lock:
            self.current_school_name = name

    def record_outcome(self, outcome: str, log_message: str) -> None:
        with self._lock:
            self.processed += 1
            if outcome == "reactivated":
                self.reactivated += 1
            elif outcome == "needs_review":
                self.needs_review += 1
            else:
                self.unverified += 1
            timestamp = time.strftime("%H:%M:%S")
            self.logs.append(f"[{timestamp}] {log_message}")
            if len(self.logs) > 50:
                self.logs = self.logs[-50:]

    def log(self, message: str) -> None:
        with self._lock:
            timestamp = time.strftime("%H:%M:%S")
            entry = f"[{timestamp}] {message}"
            self.logs.append(entry)
            if len(self.logs) > 50:
                self.logs = self.logs[-50:]

    def to_dict(self):
        with self._lock:
            elapsed = (
                int(time.time() - self.started_at) if (self.is_running and self.started_at) else 0
            )
            return {
                "is_running": self.is_running,
                "total": self.total,
                "processed": self.processed,
                "reactivated": self.reactivated,
                "needs_review": self.needs_review,
                "unverified": self.unverified,
                "current_school_name": self.current_school_name,
                "elapsed_seconds": elapsed,
                "progress_percent": round((self.processed / self.total) * 100, 1)
                if self.total > 0
                else 0,
                "logs": list(self.logs),
            }


batch_progress = BatchAuditProgress()


class BatchStatusResponse(BaseModel):
    is_running: bool
    total: int
    processed: int
    reactivated: int
    needs_review: int
    unverified: int
    current_school_name: str | None = None
    elapsed_seconds: int
    progress_percent: float
    logs: list[str]


@router.get(
    "/status", response_model=BatchStatusResponse, summary="Get live batch crawl pipeline progress"
)
def get_batch_status():
    """
    Poll this endpoint from the React frontend to display live progress bar,
    current school being processed, and execution logs.
    """
    return batch_progress.to_dict()


@router.post(
    "/run/{school_id}",
    response_model=DQAReport,
    summary="Run audit & reactivation on a single school",
)
def run_single_school_audit(school_id: str, db: Session = Depends(get_database_session)):
    """
    Executes the 3-Agent DQA Audit Pipeline for an individual school:
    1. Discovers official website via Tavily if missing/aggregator.
    2. Plans & scrapes top subpages with Firecrawl.
    3. Validates against schema via configured LLM.
    4. Reactivates to 'Verified (Active)' if score >= 75%.
    """
    try:
        report = audit_service.audit_single_school(school_id, db)
        return report
    except ValueError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Audit execution error: {err}") from err


def _run_batch_worker(school_ids: list[str]):
    """Background worker that audits inactive schools sequentially with error resilience."""
    batch_progress.start(
        total=len(school_ids),
        initial_message=f"Starting batch crawl for {len(school_ids)} inactive school(s)...",
    )

    db = DatabaseSessionFactory()
    try:
        for sid in school_ids:
            try:
                from uuid import UUID

                school = db.query(Schools).filter(Schools.id == UUID(sid)).first()
                school_name = school.name if school else sid
                batch_progress.set_current_school(school_name)
                batch_progress.log(f"Auditing '{school_name}'...")

                report = audit_service.audit_single_school(sid, db)

                if report.overall_score >= 75:
                    batch_progress.record_outcome(
                        "reactivated",
                        f"✓ Reactivated '{school_name}' (Score: {report.overall_score}%) -> Verified & Active",
                    )
                elif report.overall_score >= 50:
                    batch_progress.record_outcome(
                        "needs_review",
                        f"⚠ '{school_name}' Needs Review (Score: {report.overall_score}%)",
                    )
                else:
                    batch_progress.record_outcome(
                        "unverified",
                        f"✗ '{school_name}' Unverified (Score: {report.overall_score}%)",
                    )

            except Exception as e:
                batch_progress.record_outcome(
                    "unverified", f"Error processing {sid}: {str(e)[:100]}"
                )

            # Small cooldown to respect API rate limits
            time.sleep(1)

        batch_progress.finish(
            f"Batch crawl complete! {batch_progress.reactivated} school(s) successfully reactivated."
        )
    finally:
        db.close()
        batch_progress.finish()


@router.post("/run-batch", summary="Trigger batch audit & reactivation on inactive schools")
def run_batch_audit(
    background_tasks: BackgroundTasks,
    limit: int = Query(
        10, ge=1, le=100, description="Number of inactive schools to audit in this batch"
    ),
    db: Session = Depends(get_database_session),
):
    """
    Fetches up to `limit` inactive schools (`is_active == False`) and queues
    them for background metadata crawling and reactivation.
    """
    if batch_progress.is_running:
        raise HTTPException(
            status_code=409, detail="A batch crawl job is already currently running."
        )

    inactive_schools = (
        db.query(Schools)
        .filter(Schools.is_active == False)
        .order_by(Schools.updated_at.asc())
        .limit(limit)
        .all()
    )

    if not inactive_schools:
        return {
            "message": "No inactive schools found in the database. All schools are currently active!",
            "queued_count": 0,
        }

    school_ids = [str(s.id) for s in inactive_schools]
    background_tasks.add_task(_run_batch_worker, school_ids)

    return {
        "message": f"Successfully queued {len(school_ids)} inactive school(s) for audit.",
        "queued_count": len(school_ids),
        "schools": [{"id": str(s.id), "name": s.name, "city": s.city} for s in inactive_schools],
    }
