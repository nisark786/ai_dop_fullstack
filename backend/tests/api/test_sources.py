"""Tests for the Source Registry API.

Endpoints:
    GET   /api/sources              — list all source registry records
    PATCH /api/sources/{id}/weight  — update configured weight
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

    def test_list_sources_with_record_returns_200(
        self, client: TestClient, db_session: Session
    ) -> None:
        """
        When a SourceRegistryModel row exists, GET /api/sources returns HTTP 200
        with all attributes properly serialized.
        """
        import uuid as _uuid

        source = make_source_registry(
            db_session,
            source_name="Texas Education Agency",
            domain=f"tea-{_uuid.uuid4().hex[:8]}.texas.gov",
            configured_weight=100.0,
            historical_accuracy=98.0,
        )

        response = client.get("/api/sources")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        matched = next((item for item in data if item["id"] == source.id), None)
        assert matched is not None
        assert matched["source_name"] == "Texas Education Agency"
        assert matched["configured_weight"] == 100.0
        assert matched["historical_accuracy"] == 98.0
        assert matched["is_active"] is True
        assert "approved_ct" in matched
        assert "corrected_ct" in matched


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

    def test_update_weight_with_existing_source_returns_200(
        self, client: TestClient, db_session: Session
    ) -> None:
        """
        When a SourceRegistryModel row exists and PATCH is called, the route
        recalculates effective_weight based on historical_accuracy and returns HTTP 200.
        """
        import uuid as _uuid

        source = make_source_registry(
            db_session,
            domain=f"patch-{_uuid.uuid4().hex[:8]}.edu",
            configured_weight=100.0,
            historical_accuracy=90.0,
        )

        response = client.patch(
            f"/api/sources/{source.id}/weight",
            json={"new_weight": 80.0},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_id"] == source.id
        # effective_weight = round(80.0 * (90.0 / 100.0), 1) = 72.0
        assert data["effective_weight"] == 72.0
