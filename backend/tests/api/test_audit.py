"""
Tests for Audit Pipeline API endpoints.

Endpoints:
    GET  /api/pipelines/audit/status       — live batch audit progress
    POST /api/pipelines/audit/run/{id}     — execute audit on single school (mocked)
    POST /api/pipelines/audit/run-batch    — trigger batch audit on inactive schools
"""

import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes.audit import BatchAuditProgress, batch_progress
from app.pipelines.audit_crawler.schemas import DQAReport
from tests.factories import make_school


class TestBatchAuditProgressTracker:
    """Unit tests for the thread-safe BatchAuditProgress tracker."""

    def test_progress_start_and_finish(self) -> None:
        """Starts progress and finishes, resetting state."""
        tracker = BatchAuditProgress()
        tracker.start(total=10, initial_message="Starting test batch")
        assert tracker.is_running is True
        assert tracker.total == 10
        assert tracker.processed == 0
        assert len(tracker.logs) == 1

        tracker.finish(final_message="Finished test batch")
        assert tracker.is_running is False
        assert tracker.current_school_name is None
        assert len(tracker.logs) == 2

    def test_progress_record_outcomes(self) -> None:
        """Correctly tallies reactivated, needs_review, and unverified outcomes."""
        tracker = BatchAuditProgress()
        tracker.start(total=3)

        tracker.record_outcome("reactivated", "School A reactivated")
        tracker.record_outcome("needs_review", "School B needs review")
        tracker.record_outcome("unverified", "School C unverified")

        assert tracker.processed == 3
        assert tracker.reactivated == 1
        assert tracker.needs_review == 1
        assert tracker.unverified == 1

        d = tracker.to_dict()
        assert d["progress_percent"] == 100.0
        assert d["processed"] == 3


class TestAuditEndpoints:
    """Tests for Audit Pipeline HTTP endpoints."""

    def test_get_batch_status(self, client: TestClient) -> None:
        """GET /api/pipelines/audit/status returns BatchStatusResponse."""
        response = client.get("/api/pipelines/audit/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_running" in data
        assert "total" in data
        assert "processed" in data
        assert "reactivated" in data
        assert "logs" in data

    @patch("app.api.routes.audit.audit_service.audit_single_school")
    def test_run_single_school_audit_success(
        self, mock_audit: MagicMock, client: TestClient, db_session: Session
    ) -> None:
        """Executes single school audit and returns DQAReport (external calls mocked)."""
        school = make_school(db_session, name="Audit Target School")
        db_session.flush()

        # Mock DQAReport output
        mock_report = DQAReport(
            school_id=str(school.id),
            school_name="Audit Target School",
            overall_score=85,
            status_changed_to="Verified",
            recommendations=[],
        )
        mock_audit.return_value = mock_report

        response = client.post(f"/api/pipelines/audit/run/{school.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["school_id"] == str(school.id)
        assert data["overall_score"] == 85
        assert data["status_changed_to"] == "Verified"

    @patch("app.api.routes.audit.audit_service.audit_single_school")
    def test_run_single_school_audit_not_found(
        self, mock_audit: MagicMock, client: TestClient
    ) -> None:
        """When school is not found, returns HTTP 404."""
        mock_audit.side_effect = ValueError("School not found in database")
        response = client.post(f"/api/pipelines/audit/run/{uuid.uuid4()}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @patch("app.api.routes.audit.audit_service.audit_single_school")
    def test_run_single_school_audit_error_returns_500(
        self, mock_audit: MagicMock, client: TestClient
    ) -> None:
        """Unexpected internal exceptions return HTTP 500."""
        mock_audit.side_effect = RuntimeError("Firecrawl scrape timeout")
        response = client.post(f"/api/pipelines/audit/run/{uuid.uuid4()}")
        assert response.status_code == 500
        assert "audit execution error" in response.json()["detail"].lower()

    def test_run_batch_audit_no_inactive_schools(
        self, client: TestClient, db_session: Session
    ) -> None:
        """When no inactive schools exist, returns message with queued_count=0."""
        # Ensure progress tracker is not running
        batch_progress.finish()

        response = client.post("/api/pipelines/audit/run-batch")
        assert response.status_code == 200
        data = response.json()
        assert "no inactive schools" in data["message"].lower()
        assert data["queued_count"] == 0

    @patch("app.api.routes.audit.BackgroundTasks.add_task")
    def test_run_batch_audit_with_inactive_schools(
        self, mock_add_task: MagicMock, client: TestClient, db_session: Session
    ) -> None:
        """Queues inactive schools for background audit."""
        batch_progress.finish()

        s1 = make_school(db_session, name="Inactive 1", is_active=False)
        s2 = make_school(db_session, name="Inactive 2", is_active=False)
        db_session.flush()

        response = client.post("/api/pipelines/audit/run-batch?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["queued_count"] >= 2
        queued_ids = [s["id"] for s in data["schools"]]
        assert str(s1.id) in queued_ids
        assert str(s2.id) in queued_ids

    def test_run_batch_audit_already_running_returns_409(self, client: TestClient) -> None:
        """Triggering batch audit while one is running returns HTTP 409 Conflict."""
        batch_progress.start(total=5)
        try:
            response = client.post("/api/pipelines/audit/run-batch")
            assert response.status_code == 409
            assert "already currently running" in response.json()["detail"].lower()
        finally:
            batch_progress.finish()
