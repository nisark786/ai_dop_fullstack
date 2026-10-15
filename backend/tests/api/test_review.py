"""
Tests for HITL Review Queue API endpoints.

Endpoints:
    GET  /api/review            — list pending review queue items
    POST /api/review/{id}/approve — approve and apply recommendation to school
    POST /api/review/{id}/correct — apply human-corrected value to school
    POST /api/review/{id}/reject  — dismiss recommendation
    GET  /api/review/schools    — fetch partitioned schools by queue type
    POST /api/review/bulk-action — bulk approve, reject, or undo across schools
"""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes.review import _calculate_routing_band, _format_value_display
from app.models.schools import Schools
from tests.factories import (
    make_batch,
    make_metadata_output,
    make_school,
    make_staging_school,
)


class TestRoutingHelpers:
    """Unit tests for private helper functions in review module."""

    def test_routing_band_calculation_thresholds(self) -> None:
        """Verifies specification routing bands based on confidence scores."""
        assert _calculate_routing_band(0.96) == "Auto Publish"
        assert _calculate_routing_band(0.95) == "Auto Publish"
        assert _calculate_routing_band(0.88) == "Reviewer Approval"
        assert _calculate_routing_band(0.85) == "Reviewer Approval"
        assert _calculate_routing_band(0.75) == "Mandatory HITL Review"
        assert _calculate_routing_band(0.70) == "Mandatory HITL Review"
        assert _calculate_routing_band(0.65) == "Escalation Required"

    def test_format_value_display_types(self) -> None:
        """Formats list, boolean, None, and strings accurately."""
        assert _format_value_display(None) == ""
        assert _format_value_display(["K", "1", "2"]) == "K, 1, 2"
        assert _format_value_display(True) == "Yes"
        assert _format_value_display(False) == "No"
        assert _format_value_display("  Austin Prep  ") == "Austin Prep"


class TestGetReviewQueue:
    """Tests for GET /api/review."""

    def test_get_review_queue_empty(self, client: TestClient) -> None:
        """Returns empty list when no review outputs are pending."""
        response = client.get("/api/review")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_review_queue_with_pending_item(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Returns structured ResolvedValueResponse for pending recommendations."""
        batch = make_batch(db_session, name="Review Queue Batch")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Pending Review Academy")
        make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            batch_id=batch.id,
            verification_status="needs_review",
            applied_to_school=False,
            recommendations=[
                {
                    "field": "phone",
                    "current": "512-000-0000",
                    "recommended": "512-555-9999",
                    "confidence": 0.92,
                    "reason": "Found on official contact page",
                }
            ],
        )
        db_session.flush()

        response = client.get("/api/review")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

        matched = next((item for item in data if item["school_id"] == str(staging.id)), None)
        assert matched is not None
        assert matched["field_name"] == "phone"
        assert matched["winning_value"] == "512-555-9999"
        assert matched["previous_value"] == "512-000-0000"
        assert matched["routing_band"] == "Reviewer Approval"
        assert matched["has_conflict"] is True


class TestReviewApprove:
    """Tests for POST /api/review/{id}/approve."""

    def test_approve_staging_school_recommendation(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Approving updates staging school attribute, marks status='verified', and flags applied_to_school."""
        batch = make_batch(db_session, name="Approve Test Batch")
        staging = make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Old Staging Name",
            status="pending",
        )
        output = make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            batch_id=batch.id,
            applied_to_school=False,
            recommendations=[
                {
                    "field": "name",
                    "current": "Old Staging Name",
                    "recommended": "Approved New Name",
                    "confidence": 0.96,
                }
            ],
        )
        db_session.flush()

        response = client.post(f"/api/review/{output.id}:name/approve")
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "approved"
        assert data["status"] == "approved"

        # Verify database state
        db_session.refresh(staging)
        assert staging.name == "Approved New Name"
        assert staging.status == "verified"

        db_session.refresh(output)
        assert output.applied_to_school is True
        assert output.verification_status == "verified"

    def test_approve_production_school_recommendation(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Approving updates golden Schools table record."""
        school = make_school(
            db_session,
            name="Master School",
            phone="512-111-1111",
            is_active=False,
        )
        output = make_metadata_output(
            db_session,
            school_id=school.id,
            applied_to_school=False,
            recommendations=[
                {
                    "field": "phone",
                    "current": "512-111-1111",
                    "recommended": "512-999-9999",
                    "confidence": 0.98,
                }
            ],
        )
        db_session.flush()

        response = client.post(f"/api/review/{output.id}:phone/approve")
        assert response.status_code == 200

        db_session.refresh(school)
        assert school.phone == "512-999-9999"
        assert school.is_active is True
        assert school.profile_verification_status == "verified"

    def test_approve_not_found(self, client: TestClient) -> None:
        """Non-existent output ID returns 404."""
        response = client.post(f"/api/review/{uuid.uuid4()}/approve")
        assert response.status_code == 404

    def test_approve_invalid_uuid(self, client: TestClient) -> None:
        """Invalid UUID format returns 400."""
        response = client.post("/api/review/invalid-output-id/approve")
        assert response.status_code == 400

    def test_approve_dropped_staging_school_fails_with_410(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Approving output for a dropped (soft-deleted) staging school returns HTTP 410 Gone."""
        batch = make_batch(db_session, name="Dropped Batch")
        staging = make_staging_school(
            db_session, batch_id=batch.id, name="Dropped School", deleted_at=datetime.now(UTC)
        )
        output = make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            batch_id=batch.id,
            recommendations=[{"field": "name", "recommended": "Should Fail"}],
        )
        db_session.flush()

        response = client.post(f"/api/review/{output.id}/approve")
        assert response.status_code == 410
        assert "dropped or trashed" in response.json()["detail"].lower()


class TestReviewCorrect:
    """Tests for POST /api/review/{id}/correct."""

    def test_correct_review_item_success(self, client: TestClient, db_session: Session) -> None:
        """Human correction overwrites attribute with human-supplied value."""
        batch = make_batch(db_session, name="Correct Batch")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Before Correction")
        output = make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            batch_id=batch.id,
            recommendations=[{"field": "name", "recommended": "AI Name"}],
        )
        db_session.flush()

        payload = {"corrected_value": "Human Verified Name"}
        response = client.post(f"/api/review/{output.id}:name/correct", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "corrected"
        assert "Human Verified Name" in data["message"]

        db_session.refresh(staging)
        assert staging.name == "Human Verified Name"
        assert staging.status == "verified"

    def test_correct_missing_value_returns_422(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Payload missing corrected_value returns 422."""
        batch = make_batch(db_session, name="Validation Correct")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Test School")
        output = make_metadata_output(db_session, staging_school_id=staging.id)
        db_session.flush()

        response = client.post(f"/api/review/{output.id}:name/correct", json={})
        assert response.status_code == 422

    def test_correct_dropped_staging_school_fails_with_410(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Modifying output for a dropped (soft-deleted) staging school returns HTTP 410 Gone."""
        batch = make_batch(db_session, name="Dropped Batch Correct")
        staging = make_staging_school(
            db_session, batch_id=batch.id, name="Dropped School", deleted_at=datetime.now(UTC)
        )
        output = make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            batch_id=batch.id,
            recommendations=[{"field": "name", "recommended": "Should Fail"}],
        )
        db_session.flush()

        payload = {"corrected_value": "New Correction"}
        response = client.post(f"/api/review/{output.id}:name/correct", json=payload)
        assert response.status_code == 410
        assert "dropped or trashed" in response.json()["detail"].lower()


class TestReviewReject:
    """Tests for POST /api/review/{id}/reject."""

    def test_reject_review_item_success(self, client: TestClient, db_session: Session) -> None:
        """Dismisses recommendation and sets output.verification_status='rejected'."""
        batch = make_batch(db_session, name="Reject Batch")
        staging = make_staging_school(db_session, batch_id=batch.id, name="Reject School")
        output = make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            verification_status="needs_review",
        )
        db_session.flush()

        response = client.post(f"/api/review/{output.id}:name/reject")
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "rejected"

        db_session.refresh(output)
        assert output.verification_status == "rejected"


class TestReviewSchools:
    """Tests for GET /api/review/schools."""

    def test_get_review_schools_partitions(self, client: TestClient, db_session: Session) -> None:
        """Partitions schools accurately by queue_type."""
        batch = make_batch(db_session, name="Queue Partition Batch")
        st_verify = make_staging_school(
            db_session, batch_id=batch.id, name="Verification School", status="pending"
        )
        st_approved = make_staging_school(
            db_session, batch_id=batch.id, name="Approved School", status="approved"
        )
        st_recrawl = make_staging_school(
            db_session, batch_id=batch.id, name="Recrawl School", status="rejected"
        )
        db_session.flush()

        # 1. Verification queue
        res_v = client.get(f"/api/review/schools?batch_id={batch.id}&queue_type=verification")
        assert res_v.status_code == 200
        v_ids = [s["id"] for s in res_v.json()]
        assert str(st_verify.id) in v_ids
        assert str(st_approved.id) not in v_ids

        # 2. Approved queue
        res_a = client.get(f"/api/review/schools?batch_id={batch.id}&queue_type=approved")
        assert res_a.status_code == 200
        a_ids = [s["id"] for s in res_a.json()]
        assert str(st_approved.id) in a_ids

        # 3. Recrawl queue
        res_r = client.get(f"/api/review/schools?batch_id={batch.id}&queue_type=recrawl")
        assert res_r.status_code == 200
        r_ids = [s["id"] for s in res_r.json()]
        assert str(st_recrawl.id) in r_ids

    def test_get_review_schools_search(self, client: TestClient, db_session: Session) -> None:
        """Search query filters schools by name or district."""
        batch = make_batch(db_session, name="Search Batch")
        target_name = f"UniqueReviewTarget-{uuid.uuid4().hex[:6]}"
        make_staging_school(db_session, batch_id=batch.id, name=target_name, status="pending")
        db_session.flush()

        response = client.get(f"/api/review/schools?search={target_name}")
        assert response.status_code == 200
        items = response.json()
        assert len(items) >= 1
        assert any(s["name"] == target_name for s in items)


class TestBulkReviewAction:
    """Tests for POST /api/review/bulk-action."""

    def test_bulk_approve_schools(self, client: TestClient, db_session: Session) -> None:
        """Bulk approving marks all targeted staging schools approved."""
        batch = make_batch(db_session, name="Bulk Batch")
        s1 = make_staging_school(db_session, batch_id=batch.id, name="Bulk 1", status="pending")
        s2 = make_staging_school(db_session, batch_id=batch.id, name="Bulk 2", status="pending")
        db_session.flush()

        payload = {
            "action": "approve",
            "school_ids": [str(s1.id), str(s2.id)],
            "scope": "group",
        }
        response = client.post("/api/review/bulk-action", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["affected_count"] == 2
        assert set(data["updated_school_ids"]) == {str(s1.id), str(s2.id)}

        db_session.refresh(s1)
        db_session.refresh(s2)
        assert s1.status == "approved"
        assert s2.status == "approved"

    def test_bulk_reject_schools(self, client: TestClient, db_session: Session) -> None:
        """Bulk rejecting sets status to 'rejected'."""
        batch = make_batch(db_session, name="Bulk Reject")
        s = make_staging_school(db_session, batch_id=batch.id, name="To Reject", status="pending")
        db_session.flush()

        payload = {"action": "reject", "school_ids": [str(s.id)], "scope": "single"}
        response = client.post("/api/review/bulk-action", json=payload)
        assert response.status_code == 200
        assert response.json()["affected_count"] == 1

        db_session.refresh(s)
        assert s.status == "rejected"

    def test_bulk_undo_action(self, client: TestClient, db_session: Session) -> None:
        """Bulk undo resets approved or rejected school back to 'needs_review'."""
        batch = make_batch(db_session, name="Bulk Undo")
        s = make_staging_school(db_session, batch_id=batch.id, name="To Undo", status="approved")
        db_session.flush()

        payload = {"action": "undo", "school_ids": [str(s.id)], "scope": "single"}
        response = client.post("/api/review/bulk-action", json=payload)
        assert response.status_code == 200
        assert response.json()["affected_count"] == 1

        db_session.refresh(s)
        assert s.status == "needs_verification"

    def test_bulk_action_batch_scope(self, client: TestClient, db_session: Session) -> None:
        """Applies bulk approve to all eligible schools in a batch."""
        batch = make_batch(db_session, name="Batch Scope Bulk")
        make_staging_school(db_session, batch_id=batch.id, name="BS 1", status="pending")
        make_staging_school(db_session, batch_id=batch.id, name="BS 2", status="pending")
        db_session.flush()

        payload = {"action": "approve", "batch_id": str(batch.id), "scope": "batch"}
        response = client.post("/api/review/bulk-action", json=payload)
        assert response.status_code == 200
        assert response.json()["affected_count"] == 2

    def test_bulk_publish_school_creates_production_school(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Publishing an approved staging school creates a row in the golden schools table and sets status to published."""
        batch = make_batch(db_session, name="Publish Batch")
        s = make_staging_school(
            db_session,
            batch_id=batch.id,
            name="To Publish Academy",
            status="approved",
            address="123 Production Blvd",
            website="https://publishacademy.org",
        )
        db_session.flush()

        payload = {"action": "publish", "school_ids": [str(s.id)], "scope": "single"}
        response = client.post("/api/review/bulk-action", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["affected_count"] == 1
        assert "Published" in data["message"]

        db_session.refresh(s)
        assert s.status == "published"
        assert s.production_school_id is not None

        prod_school = db_session.query(Schools).filter(Schools.id == s.production_school_id).first()
        assert prod_school is not None
        assert prod_school.name == "To Publish Academy"
        assert prod_school.address == "123 Production Blvd"

    def test_bulk_publish_batch_scope(self, client: TestClient, db_session: Session) -> None:
        """Publishing batch scope promotes all approved schools in the batch."""
        batch = make_batch(db_session, name="Publish Batch All")
        s1 = make_staging_school(db_session, batch_id=batch.id, name="PB 1", status="approved")
        s2 = make_staging_school(db_session, batch_id=batch.id, name="PB 2", status="approved")
        db_session.flush()

        payload = {"action": "publish", "batch_id": str(batch.id), "scope": "batch"}
        response = client.post("/api/review/bulk-action", json=payload)
        assert response.status_code == 200
        assert response.json()["affected_count"] == 2

        db_session.refresh(s1)
        db_session.refresh(s2)
        assert s1.status == "published"
        assert s2.status == "published"
        assert s1.production_school_id is not None
        assert s2.production_school_id is not None

    def test_get_review_schools_approved_excludes_published(
        self, client: TestClient, db_session: Session
    ) -> None:
        """GET /api/review/schools?queue_type=approved returns only pending approved schools, excluding published."""
        batch = make_batch(db_session, name="Approved & Published Batch")
        make_staging_school(
            db_session, batch_id=batch.id, name="Approved School", status="approved"
        )
        make_staging_school(
            db_session, batch_id=batch.id, name="Published School", status="published"
        )
        db_session.flush()

        response = client.get(f"/api/review/schools?queue_type=approved&batch_id={batch.id}")
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1

        names = {item["name"] for item in items}
        assert "Approved School" in names
        assert "Published School" not in names

    def test_retry_sandbox_sync_invalid_id(self, client: TestClient) -> None:
        """POST /api/review/schools/{id}/retry-sandbox-sync returns 400 for invalid UUID."""
        res = client.post("/api/review/schools/invalid-uuid/retry-sandbox-sync")
        assert res.status_code == 400

    def test_retry_sandbox_sync_not_found(self, client: TestClient) -> None:
        """POST /api/review/schools/{id}/retry-sandbox-sync returns 404 for unknown school."""
        import uuid

        res = client.post(f"/api/review/schools/{uuid.uuid4()}/retry-sandbox-sync")
        assert res.status_code == 404

    def test_retry_sandbox_sync_success(
        self, client: TestClient, db_session: Session, monkeypatch
    ) -> None:
        """POST /api/review/schools/{id}/retry-sandbox-sync successfully triggers sync and updates metadata."""
        from app.services.sandbox_sync.sync_service import SandboxSyncResult

        batch = make_batch(db_session, name="Retry Sandbox Batch")
        staging = make_staging_school(
            db_session, batch_id=batch.id, name="Sandbox Test Academy", status="published"
        )
        db_session.flush()

        monkeypatch.setattr(
            "app.services.sandbox_sync.sync_service.SandboxSyncService.sync_school",
            lambda **kwargs: SandboxSyncResult(
                status="synced",
                sandbox_id="sb-uuid-12345",
                message="Synced successfully",
                synced_at="2026-10-15T12:00:00Z",
            ),
        )

        res = client.post(f"/api/review/schools/{staging.id}/retry-sandbox-sync")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "synced"
        assert data["sandbox_id"] == "sb-uuid-12345"
        assert data["school_id"] == str(staging.id)

        db_session.refresh(staging)
        assert staging.metadata_json is not None
        assert staging.metadata_json["sandbox_sync"]["status"] == "synced"
        assert staging.metadata_json["sandbox_sync"]["sandbox_id"] == "sb-uuid-12345"
