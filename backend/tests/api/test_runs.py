"""
Tests for Pipeline Runs API endpoints.

Endpoints:
    GET /api/runs                    — list all batch execution runs
    GET /api/runs/{job_id}           — get details of a specific batch run
    GET /api/runs/{job_id}/export/html  — download standalone HTML report
    GET /api/runs/{job_id}/export/excel — download Excel workbook
    GET /api/runs/{job_id}/export/csv   — download CSV export
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes.runs import _slugify
from tests.factories import make_batch, make_metadata_output, make_school


class TestRunsHelpers:
    """Unit tests for runs private helper functions."""

    def test_slugify_converts_spaces_and_special_chars(self) -> None:
        """Converts titles into URL/filename-safe slugs."""
        assert _slugify("Batch Intake #1 (Texas)") == "batch-intake-1-texas"
        assert _slugify("   Simple Name   ") == "simple-name"
        assert _slugify("") == "batch"


class TestListRuns:
    """Tests for GET /api/runs."""

    def test_list_runs_returns_200(self, client: TestClient) -> None:
        """GET /api/runs returns 200 and a list."""
        response = client.get("/api/runs")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_runs_groups_by_job_id(self, client: TestClient, db_session: Session) -> None:
        """Outputs with the same job_id are aggregated into a single BatchRunSummary."""
        unique_job = f"JOB-RUN-{uuid.uuid4().hex[:6]}"
        batch = make_batch(db_session, name="Runs Test Batch")

        make_metadata_output(
            db_session,
            job_id=unique_job,
            batch_id=batch.id,
            overall_score=90.0,
            verification_status="verified",
        )
        make_metadata_output(
            db_session,
            job_id=unique_job,
            batch_id=batch.id,
            overall_score=80.0,
            verification_status="needs_review",
        )
        db_session.flush()

        response = client.get("/api/runs")
        assert response.status_code == 200
        items = response.json()
        matched = next((r for r in items if r["job_id"] == unique_job), None)

        assert matched is not None
        assert matched["total_schools"] == 2
        assert matched["verified_count"] == 1
        assert matched["needs_review_count"] == 1
        assert matched["avg_score"] == 85
        assert matched["batch_name"] == "Runs Test Batch"


class TestRunDetail:
    """Tests for GET /api/runs/{job_id}."""

    def test_get_run_detail_success(self, client: TestClient, db_session: Session) -> None:
        """Retrieves full run summary and school output items."""
        job_id = f"JOB-DETAIL-{uuid.uuid4().hex[:6]}"
        batch = make_batch(db_session, name="Detail Run Batch")
        school = make_school(db_session, name="Detail School")

        make_metadata_output(
            db_session,
            job_id=job_id,
            batch_id=batch.id,
            school_id=school.id,
            overall_score=94.0,
            verification_status="verified",
        )
        db_session.flush()

        response = client.get(f"/api/runs/{job_id}")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "schools" in data
        assert data["summary"]["job_id"] == job_id
        assert len(data["schools"]) == 1
        assert data["schools"][0]["school_name"] == "Detail School"

    def test_get_run_detail_not_found(self, client: TestClient) -> None:
        """Non-existent job_id returns HTTP 404."""
        response = client.get("/api/runs/NON-EXISTENT-JOB-ID")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestRunsExport:
    """Tests for HTML, Excel, and CSV run exports."""

    def _setup_run(self, db: Session) -> str:
        job_id = f"JOB-EXP-{uuid.uuid4().hex[:6]}"
        batch = make_batch(db, name="Export Run Batch")
        school = make_school(db, name="Export School")
        make_metadata_output(
            db,
            job_id=job_id,
            batch_id=batch.id,
            school_id=school.id,
            overall_score=92.0,
        )
        db.flush()
        return job_id

    def test_export_run_html(self, client: TestClient, db_session: Session) -> None:
        """GET /api/runs/{job_id}/export/html returns HTML report."""
        job_id = self._setup_run(db_session)
        response = client.get(f"/api/runs/{job_id}/export/html")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "attachment" in response.headers["content-disposition"]
        assert f"report-export-run-batch-{job_id}.html" in response.headers["content-disposition"]
        assert len(response.text) > 100

    def test_export_run_excel(self, client: TestClient, db_session: Session) -> None:
        """GET /api/runs/{job_id}/export/excel returns XLSX workbook."""
        job_id = self._setup_run(db_session)
        response = client.get(f"/api/runs/{job_id}/export/excel")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats" in response.headers["content-type"]
        assert f"run-export-run-batch-{job_id}.xlsx" in response.headers["content-disposition"]
        assert len(response.content) > 100

    def test_export_run_csv(self, client: TestClient, db_session: Session) -> None:
        """GET /api/runs/{job_id}/export/csv returns CSV data."""
        job_id = self._setup_run(db_session)
        response = client.get(f"/api/runs/{job_id}/export/csv")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert f"run-export-run-batch-{job_id}.csv" in response.headers["content-disposition"]
        assert "School Name" in response.text or "Export School" in response.text
