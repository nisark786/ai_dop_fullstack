"""
Tests for the Source Registry API.

Endpoints:
    GET  /api/sources              — list all source registry records
    PATCH /api/sources/{id}/weight — update configured weight

Note on model–schema mismatch
------------------------------
The `SourceRegistryModel` ORM model (pipeline.py) exposes columns:
    id, domain, source_tier, base_weight, description, is_active

But the route (sources.py) accesses:
    s.source_name, s.domain_pattern, s.category, s.configured_weight,
    s.effective_weight, s.approved_count, s.corrected_count,
    s.rejected_count, s.total_reviews, s.historical_accuracy

These attributes do NOT exist on the model.  Accessing them raises an
``AttributeError`` inside Pydantic validation, which FastAPI converts to an
HTTP 500.

Tests below:
- Verify the empty-table fast-path returns [] without touching model attrs.
- Document the 500 behaviour when rows exist (attribute mismatch).
- Verify PATCH 404 when source is not found (no attribute access needed).
- Verify PATCH 500 when source exists but attributes are missing.

These tests intentionally capture the *current* behaviour so that when the
model is fixed (columns added) the tests can be updated to expect 200.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.factories import make_source_registry


class TestListSources:
    """Tests for GET /api/sources."""

    def test_list_sources_empty_returns_empty_list(self, client: TestClient) -> None:
        """GET /api/sources returns [] when no source records exist."""
        response = client.get("/api/sources")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_sources_returns_json_array(self, client: TestClient) -> None:
        """Response Content-Type must be application/json and body must be a list."""
        response = client.get("/api/sources")
        assert "application/json" in response.headers["content-type"]
        assert isinstance(response.json(), list)

    def test_list_sources_with_record_raises_due_to_model_mismatch(
        self, client: TestClient, db_session: Session
    ) -> None:
        """
        When a SourceRegistryModel row exists, the route tries to access
        s.source_name, s.domain_pattern, etc., which do NOT exist on the
        current ORM model.  FastAPI returns HTTP 500.

        This test documents the known model–schema mismatch.  Once the ORM
        model is updated to include those columns, this test should be updated
        to expect HTTP 200 with the record in the response body.
        """
        import uuid as _uuid

        make_source_registry(db_session, domain=f"test-{_uuid.uuid4().hex[:8]}.edu")
        # No commit — flush only; session rollback cleans up after the test

        response = client.get("/api/sources")
        # Current behaviour: AttributeError → 500
        assert response.status_code == 500


class TestUpdateSourceWeight:
    """Tests for PATCH /api/sources/{id}/weight."""

    def test_update_weight_not_found_returns_404(self, client: TestClient) -> None:
        """PATCH with a non-existent source ID returns 404."""
        response = client.patch(
            "/api/sources/nonexistent-id/weight",
            json={"new_weight": 75.0},
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_weight_invalid_payload_returns_422(self, client: TestClient) -> None:
        """PATCH with missing required field returns 422 Unprocessable Entity."""
        response = client.patch(
            "/api/sources/any-id/weight",
            json={},  # missing new_weight
        )
        assert response.status_code == 422

    def test_update_weight_above_max_returns_422(self, client: TestClient) -> None:
        """new_weight > 100.0 is rejected by Pydantic validation (le=100.0)."""
        response = client.patch(
            "/api/sources/any-id/weight",
            json={"new_weight": 150.0},
        )
        assert response.status_code == 422

    def test_update_weight_below_min_returns_422(self, client: TestClient) -> None:
        """new_weight < 0.0 is rejected by Pydantic validation (ge=0.0)."""
        response = client.patch(
            "/api/sources/any-id/weight",
            json={"new_weight": -1.0},
        )
        assert response.status_code == 422

    def test_update_weight_with_existing_source_raises_due_to_model_mismatch(
        self, client: TestClient, db_session: Session
    ) -> None:
        """
        When a SourceRegistryModel row exists and PATCH is called, the route
        tries to read s.historical_accuracy (not in the current ORM model)
        to compute effective_weight.  This results in an AttributeError → 500.

        This test documents the known model–schema mismatch.  Once the ORM
        model is updated, this test should expect 200 with a recalculated
        effective_weight.
        """
        import uuid as _uuid

        source = make_source_registry(db_session, domain=f"patch-{_uuid.uuid4().hex[:8]}.edu")
        # No commit — flush only; session rollback cleans up after the test

        response = client.patch(
            f"/api/sources/{source.id}/weight",
            json={"new_weight": 80.0},
        )
        # Current behaviour: AttributeError on s.historical_accuracy → 500
        assert response.status_code == 500
