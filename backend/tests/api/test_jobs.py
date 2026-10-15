"""
Tests for Crawl Jobs API endpoints.

Endpoints:
    GET  /api/jobs              — list crawler jobs with limit parameter
    POST /api/jobs/start        — queue a new crawl extraction job
    POST /api/jobs/{id}/retry   — re-queue an existing job
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.pipeline import CrawlJobModel
from tests.factories import make_crawl_job


class TestListJobs:
    """Tests for GET /api/jobs."""

    def test_list_jobs_returns_200(self, client: TestClient) -> None:
        """GET /api/jobs returns HTTP 200 and a list."""
        response = client.get("/api/jobs")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_jobs_returns_created_job(self, client: TestClient, db_session: Session) -> None:
        """Jobs created in the database are returned in the response."""
        unique_school_id = f"sch-{uuid.uuid4().hex[:8]}"
        job = make_crawl_job(
            db_session,
            school_id=unique_school_id,
            agent_name="MetadataDiscoveryAgent",
            product_name="School Profile & Metadata",
            status="running",
        )
        db_session.commit()

        response = client.get("/api/jobs")
        assert response.status_code == 200
        job_ids = [j["id"] for j in response.json()]
        assert job.id in job_ids

        # Verify schema mapping
        matched = next(j for j in response.json() if j["id"] == job.id)
        assert matched["school_id"] == unique_school_id
        assert matched["agent_name"] == "MetadataDiscoveryAgent"
        assert matched["product_name"] == "School Profile & Metadata"
        assert matched["status"] == "running"

    def test_list_jobs_respects_limit(self, client: TestClient, db_session: Session) -> None:
        """The limit query parameter caps the maximum records returned."""
        for _ in range(5):
            make_crawl_job(db_session, school_id=f"sch-{uuid.uuid4().hex[:6]}")
        db_session.commit()

        response = client.get("/api/jobs?limit=3")
        assert response.status_code == 200
        assert len(response.json()) <= 3

    def test_list_jobs_invalid_limit_below_min_returns_422(self, client: TestClient) -> None:
        """Querying with limit < 1 is rejected by FastAPI/Pydantic validation."""
        response = client.get("/api/jobs?limit=0")
        assert response.status_code == 422

    def test_list_jobs_invalid_limit_above_max_returns_422(self, client: TestClient) -> None:
        """Querying with limit > 200 is rejected by FastAPI/Pydantic validation."""
        response = client.get("/api/jobs?limit=500")
        assert response.status_code == 422


class TestStartJob:
    """Tests for POST /api/jobs/start."""

    def test_start_job_success(self, client: TestClient, db_session: Session) -> None:
        """POST /api/jobs/start creates a CrawlJobModel record with status 'queued'."""
        unique_school_id = f"sch-{uuid.uuid4().hex[:8]}"
        payload = {
            "agent_name": "MetadataAgent",
            "product_name": "School Profile & Metadata",
            "school_id": unique_school_id,
        }
        response = client.post("/api/jobs/start", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert "job_id" in data
        assert data["job_id"].startswith("JOB-")
        assert data["status"] == "queued"
        assert "queued successfully" in data["message"]

        # Verify persisted in database
        db_record = (
            db_session.query(CrawlJobModel).filter(CrawlJobModel.id == data["job_id"]).first()
        )
        assert db_record is not None
        assert db_record.school_id == unique_school_id
        assert db_record.status == "queued"
        assert db_record.current_step == "init"

    def test_start_job_validation_rejects_empty_agent(self, client: TestClient) -> None:
        """Payload with agent_name shorter than min_length=2 returns 422."""
        response = client.post(
            "/api/jobs/start",
            json={"agent_name": "A", "school_id": "sch-01"},
        )
        assert response.status_code == 422

    def test_start_job_with_default_fields(self, client: TestClient, db_session: Session) -> None:
        """POST /api/jobs/start with empty JSON uses schema defaults."""
        response = client.post("/api/jobs/start", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"

        job = db_session.query(CrawlJobModel).filter(CrawlJobModel.id == data["job_id"]).first()
        assert job is not None
        assert job.agent_name == "MetadataAgent"
        assert job.school_id == "batch-manual"


class TestRetryJob:
    """Tests for POST /api/jobs/{id}/retry."""

    def test_retry_job_success(self, client: TestClient, db_session: Session) -> None:
        """Retrying an existing job resets status to 'queued' and clears error_message."""
        failed_job = make_crawl_job(
            db_session,
            status="failed",
            current_step="extracting",
            error_message="Connection timed out after 30 seconds",
        )
        db_session.commit()

        response = client.post(f"/api/jobs/{failed_job.id}/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == failed_job.id
        assert data["status"] == "queued"
        assert "re-queued successfully" in data["message"]

        # Verify state in DB
        db_session.refresh(failed_job)
        assert failed_job.status == "queued"
        assert failed_job.error_message is None
        assert failed_job.current_step == "init"

    def test_retry_job_not_found_returns_404(self, client: TestClient) -> None:
        """Retrying a non-existent job ID returns HTTP 404."""
        response = client.post("/api/jobs/nonexistent-job-uuid/retry")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
