"""Integration and contract tests for the AI Agents API endpoints.

Covers:
- GET /api/agents/registry (Agent Catalog & implementation status)
- POST /api/agents/run-for-batch (Multi-agent execution dispatch & background tasks)
- GET /api/agents/jobs (Real-time agent execution progress & status calculation)
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.batch import BatchSchoolModel
from tests.factories import (
    make_batch,
    make_crawl_job,
    make_school,
    make_staging_school,
)


class TestGetAgentRegistry:
    """Tests for GET /api/agents/registry."""

    def test_get_agent_registry_returns_200(self, client: TestClient):
        response = client.get("/api/agents/registry")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_agent_registry_contains_metadata_agent_v1(self, client: TestClient):
        response = client.get("/api/agents/registry")
        data = response.json()
        agent = next((a for a in data if a["agent_id"] == "metadata_agent_v1"), None)
        assert agent is not None
        assert agent["product_key"] == "info"
        assert agent["product_name"] == "School Profile & Metadata"
        assert agent["is_implemented"] is True
        assert agent["status"] == "active"
        assert "target_fields" in agent
        assert "name" in agent["target_fields"]
        assert "website" in agent["target_fields"]


class TestRunAgentsForBatch:
    """Tests for POST /api/agents/run-for-batch."""

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_run_agents_single_scope_success(
        self,
        mock_worker: MagicMock,
        client: TestClient,
        db_session: Session,
    ):
        batch = make_batch(db_session, name="Single Scope Batch", status="ready")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Lincoln High")

        payload = {
            "batch_ids": [str(batch.id)],
            "agent_keys": ["info"],
            "scope": "single",
            "school_ids": [str(staging.id)],
            "force_refresh": False,
        }

        response = client.post("/api/agents/run-for-batch", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert len(data["dispatched"]) == 1
        dispatch = data["dispatched"][0]
        assert dispatch["batch_id"] == str(batch.id)
        assert dispatch["agent_id"] == "metadata_agent_v1"
        assert dispatch["target_count"] == 1
        assert dispatch["status"] == "queued"
        assert data["skipped"] == []

        mock_worker.assert_called_once()

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_run_agents_group_scope_success(
        self,
        mock_worker: MagicMock,
        client: TestClient,
        db_session: Session,
    ):
        batch = make_batch(db_session, name="Group Scope Batch", status="ready")
        s1 = make_staging_school(db_session, batch_id=batch.id, name="School Alpha")
        s2 = make_staging_school(db_session, batch_id=batch.id, name="School Beta")

        payload = {
            "batch_ids": [str(batch.id)],
            "agent_keys": ["info"],
            "scope": "group",
            "school_ids": [str(s1.id), str(s2.id)],
            "force_refresh": True,
        }

        response = client.post("/api/agents/run-for-batch", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert len(data["dispatched"]) == 1
        assert data["dispatched"][0]["target_count"] == 2
        mock_worker.assert_called_once()

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_run_agents_batch_scope_staging_schools(
        self,
        mock_worker: MagicMock,
        client: TestClient,
        db_session: Session,
    ):
        batch = make_batch(db_session, name="Batch Scope Batch", status="ready")
        make_staging_school(db_session, batch_id=batch.id, name="School 1")
        make_staging_school(db_session, batch_id=batch.id, name="School 2")
        make_staging_school(db_session, batch_id=batch.id, name="School 3")

        payload = {
            "batch_ids": [str(batch.id)],
            "agent_keys": ["info"],
            "scope": "batch",
            "school_ids": [],
            "force_refresh": False,
        }

        response = client.post("/api/agents/run-for-batch", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert len(data["dispatched"]) == 1
        assert data["dispatched"][0]["target_count"] == 3

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_run_agents_batch_scope_legacy_batch_schools(
        self,
        mock_worker: MagicMock,
        client: TestClient,
        db_session: Session,
    ):
        batch = make_batch(db_session, name="Legacy Batch", status="ready")
        school = make_school(db_session, name="Legacy School")
        bs = BatchSchoolModel(batch_id=batch.id, school_id=school.id, status="ready")
        db_session.add(bs)
        db_session.commit()

        payload = {
            "batch_ids": [str(batch.id)],
            "agent_keys": ["info"],
            "scope": "batch",
            "school_ids": [],
            "force_refresh": False,
        }

        response = client.post("/api/agents/run-for-batch", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert len(data["dispatched"]) == 1
        assert data["dispatched"][0]["target_count"] == 1

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_run_agents_nonexistent_batch_returns_empty_dispatched(
        self,
        mock_worker: MagicMock,
        client: TestClient,
    ):
        fake_id = str(uuid4())
        payload = {
            "batch_ids": [fake_id],
            "agent_keys": ["info"],
            "scope": "batch",
            "school_ids": [],
        }

        response = client.post("/api/agents/run-for-batch", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["dispatched"] == []
        mock_worker.assert_not_called()

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_run_agents_unimplemented_agent_key_skipped(
        self,
        mock_worker: MagicMock,
        client: TestClient,
        db_session: Session,
    ):
        batch = make_batch(db_session, name="Skipped Agent Batch")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Test School")

        payload = {
            "batch_ids": [str(batch.id)],
            "agent_keys": ["info", "tuition_pricing_agent_v2"],
            "scope": "single",
            "school_ids": [str(staging.id)],
        }

        response = client.post("/api/agents/run-for-batch", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["dispatched"]) == 1
        assert "tuition_pricing_agent_v2" in data["skipped"]

    def test_run_agents_invalid_payload_returns_422(self, client: TestClient):
        response = client.post("/api/agents/run-for-batch", json={})
        assert response.status_code == 422


class TestGetAgentJobs:
    """Tests for GET /api/agents/jobs."""

    def test_get_jobs_empty_when_no_active_runs(self, client: TestClient, db_session: Session):
        batch = make_batch(db_session, name="Idle Batch")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Idle School",
            metadata_json={"products": {"info": {"status": "not_run"}}},
        )

        response = client.get("/api/agents/jobs")
        assert response.status_code == 200
        data = response.json()
        # Batches with no job runs are skipped
        assert not any(j["batch_id"] == str(batch.id) for j in data)

    def test_get_jobs_with_staging_schools_in_running_state(
        self, client: TestClient, db_session: Session
    ):
        batch = make_batch(db_session, name="Running Batch")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Running School",
            metadata_json={
                "products": {
                    "info": {
                        "status": "running",
                        "job_id": "JOB-1001",
                        "started_at": datetime.now(UTC).isoformat(),
                    }
                }
            },
        )

        response = client.get("/api/agents/jobs")
        assert response.status_code == 200
        data = response.json()

        job = next((j for j in data if j["batch_id"] == str(batch.id)), None)
        assert job is not None
        assert job["status"] == "running"
        assert job["job_id"] == "JOB-1001"
        assert job["target_count"] == 1
        assert job["completed_count"] == 0

    def test_get_jobs_with_completed_and_failed_schools(
        self, client: TestClient, db_session: Session
    ):
        batch = make_batch(db_session, name="Mixed Batch")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Verified School",
            metadata_json={
                "products": {
                    "info": {
                        "status": "verified",
                        "job_id": "JOB-2002",
                        "completed_at": datetime.now(UTC).isoformat(),
                    }
                }
            },
        )
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Failed School",
            metadata_json={
                "products": {
                    "info": {
                        "status": "failed",
                        "job_id": "JOB-2002",
                    }
                }
            },
        )

        response = client.get(f"/api/agents/jobs?batch_id={batch.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        job = data[0]
        assert job["status"] == "failed"
        assert job["completed_count"] == 1
        assert job["failed_count"] == 1

    def test_get_jobs_filter_by_status(self, client: TestClient, db_session: Session):
        batch = make_batch(db_session, name="Completed Batch")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Verified School Only",
            metadata_json={
                "products": {
                    "info": {
                        "status": "verified",
                        "job_id": "JOB-3003",
                    }
                }
            },
        )

        # Filter by running -> should return empty
        res_running = client.get(f"/api/agents/jobs?batch_ids={batch.id}&status=running")
        assert res_running.status_code == 200
        assert len(res_running.json()) == 0

        # Filter by completed -> should return the job
        res_completed = client.get(f"/api/agents/jobs?batch_ids={batch.id}&status=completed")
        assert res_completed.status_code == 200
        assert len(res_completed.json()) == 1

    def test_get_jobs_falls_back_to_crawl_job_for_started_at(
        self, client: TestClient, db_session: Session
    ):
        batch = make_batch(db_session, name="Crawl Job Fallback Batch")
        make_crawl_job(db_session, job_id="JOB-CRAWL-99", status="Running")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Fallback School",
            metadata_json={
                "products": {
                    "info": {
                        "status": "running",
                        "job_id": "JOB-CRAWL-99",
                    }
                }
            },
        )

        response = client.get(f"/api/agents/jobs?batch_id={batch.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["started_at"] is not None


class TestJobControlActions:
    """Tests for POST /api/agents/jobs/{id}/pause, resume, and cancel."""

    def test_pause_agent_job_success(self, client: TestClient, db_session: Session):
        make_batch(db_session, name="Active Batch", status="processing")
        job = make_crawl_job(db_session, job_id="JOB-PAUSE-1", status="Running")

        response = client.post(f"/api/agents/jobs/{job.id}/pause")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paused"
        assert "paused" in data["message"].lower()

        db_session.refresh(job)
        assert job.status == "Paused"

    def test_pause_agent_job_not_found(self, client: TestClient):
        response = client.post("/api/agents/jobs/NONEXISTENT-JOB/pause")
        assert response.status_code == 404

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_resume_agent_job_success(
        self, mock_worker: MagicMock, client: TestClient, db_session: Session
    ):
        batch = make_batch(db_session, name="Paused Batch", status="paused")
        job = make_crawl_job(db_session, job_id="JOB-RESUME-1", status="Paused")
        # 1 completed school, 1 stuck school, 1 pending school
        make_staging_school(db_session, batch_id=batch.id, name="Done", status="needs_verification")
        make_staging_school(db_session, batch_id=batch.id, name="Stuck", status="crawling")
        make_staging_school(db_session, batch_id=batch.id, name="Pending", status="pending")

        response = client.post(f"/api/agents/jobs/{job.id}/resume?workers=3")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert "2 remaining schools" in data["message"]

        db_session.refresh(batch)
        db_session.refresh(job)
        assert batch.status == "processing"
        assert job.status == "Running"
        mock_worker.assert_called_once()

    def test_cancel_agent_job_success(self, client: TestClient, db_session: Session):
        batch = make_batch(db_session, name="Cancel Batch", status="processing")
        job = make_crawl_job(db_session, job_id="JOB-CANCEL-1", status="Running")
        stuck = make_staging_school(
            db_session, batch_id=batch.id, name="Stuck School", status="crawling"
        )

        response = client.post(f"/api/agents/jobs/{job.id}/cancel")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

        db_session.refresh(batch)
        db_session.refresh(job)
        db_session.refresh(stuck)
        assert batch.status == "ready"
        assert job.status == "Cancelled"
        assert stuck.status == "pending"

    def test_pause_job_affects_only_target_batch(self, client: TestClient, db_session: Session):
        """Pausing Job A pauses Batch A only, leaving Batch B processing."""
        batch_a = make_batch(db_session, name="Batch A", status="processing")
        batch_b = make_batch(db_session, name="Batch B", status="processing")
        job_a = make_crawl_job(db_session, job_id="JOB-A-PAUSE", status="Running")

        make_staging_school(
            db_session,
            batch_id=batch_a.id,
            name="School A",
            status="crawling",
            metadata_json={"products": {"info": {"job_id": job_a.id}}},
        )
        make_staging_school(
            db_session,
            batch_id=batch_b.id,
            name="School B",
            status="crawling",
            metadata_json={"products": {"info": {"job_id": "JOB-B"}}},
        )
        db_session.flush()

        response = client.post(f"/api/agents/jobs/{job_a.id}/pause?batch_id={batch_a.id}")
        assert response.status_code == 200

        db_session.refresh(batch_a)
        db_session.refresh(batch_b)
        assert batch_a.status == "paused"
        assert batch_b.status == "processing"  # Batch B untouched!

    def test_cancel_job_affects_only_target_batch(self, client: TestClient, db_session: Session):
        """Canceling Job A resets Batch A only, leaving Batch B processing and untouched."""
        batch_a = make_batch(db_session, name="Batch A Cancel", status="processing")
        batch_b = make_batch(db_session, name="Batch B Stay Active", status="processing")
        job_a = make_crawl_job(db_session, job_id="JOB-A-CANCEL", status="Running")

        school_a = make_staging_school(
            db_session,
            batch_id=batch_a.id,
            name="School A",
            status="crawling",
            metadata_json={"products": {"info": {"job_id": job_a.id}}},
        )
        school_b = make_staging_school(
            db_session,
            batch_id=batch_b.id,
            name="School B",
            status="crawling",
            metadata_json={"products": {"info": {"job_id": "JOB-B"}}},
        )
        db_session.flush()

        response = client.post(f"/api/agents/jobs/{job_a.id}/cancel?batch_id={batch_a.id}")
        assert response.status_code == 200

        db_session.refresh(batch_a)
        db_session.refresh(batch_b)
        db_session.refresh(school_a)
        db_session.refresh(school_b)

        assert batch_a.status == "ready"
        assert school_a.status == "pending"
        assert batch_b.status == "processing"  # Batch B unchanged!
        assert school_b.status == "crawling"  # School B unchanged!

    @patch("app.api.routes.agents.run_batch_metadata_worker")
    def test_resume_job_targets_exact_batch(
        self, mock_worker: MagicMock, client: TestClient, db_session: Session
    ):
        """Resuming Job A targets Batch A even if Batch B was updated later."""
        batch_a = make_batch(db_session, name="Batch A Older", status="paused")
        batch_b = make_batch(db_session, name="Batch B Newer", status="paused")
        job_a = make_crawl_job(db_session, job_id="JOB-A-RESUME", status="Paused")

        make_staging_school(
            db_session,
            batch_id=batch_a.id,
            name="School A",
            status="pending",
            metadata_json={"products": {"info": {"job_id": job_a.id}}},
        )
        make_staging_school(
            db_session,
            batch_id=batch_b.id,
            name="School B",
            status="pending",
            metadata_json={"products": {"info": {"job_id": "JOB-B"}}},
        )
        db_session.flush()

        response = client.post(f"/api/agents/jobs/{job_a.id}/resume?batch_id={batch_a.id}")
        assert response.status_code == 200

        db_session.refresh(batch_a)
        db_session.refresh(batch_b)
        assert batch_a.status == "processing"
        assert batch_b.status == "paused"  # Batch B unchanged!

    @patch("app.api.routes.batches._run_batch_metadata_worker")
    def test_run_metadata_agent_skips_dropped_schools(
        self, mock_worker: MagicMock, client: TestClient, db_session: Session
    ):
        """Whole batch scope skips soft-deleted/dropped staging schools."""
        batch = make_batch(db_session, name="Dropped Schools Batch", status="ready")
        make_staging_school(db_session, batch_id=batch.id, name="Active School 1")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Dropped School 2",
            deleted_at=datetime.now(UTC),
        )
        db_session.flush()

        response = client.post(
            f"/api/batches/{batch.id}/run-metadata-agent",
            json={"scope": "batch", "force_refresh": False, "workers": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["target_count"] == 1  # Exactly 1 active school, dropped school skipped!

    def test_batch_transitions_to_completed_when_all_schools_verified(self, db_session: Session):
        """When all staging schools in a batch are verified, worker reconciles batch status to completed."""
        from sqlalchemy.orm import sessionmaker

        from app.services.agents.batch_agent_worker import run_batch_metadata_worker

        batch = make_batch(db_session, name="All Verified Batch", status="processing")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="School 1",
            status="verified",
        )
        job = make_crawl_job(db_session, job_id="JOB-COMPLETE-TEST", status="Running")
        db_session.commit()

        test_factory = sessionmaker(bind=db_session.get_bind(), autocommit=False, autoflush=False)

        with patch("app.services.agents.batch_agent_worker.DatabaseSessionFactory", test_factory):
            # Run worker with 0 remaining schools (empty list)
            run_batch_metadata_worker(
                batch_id=str(batch.id),
                school_ids=[],
                job_id=job.id,
                workers=1,
            )

        db_session.refresh(batch)
        db_session.refresh(job)
        assert batch.status == "completed"
        assert job.status == "Completed"
