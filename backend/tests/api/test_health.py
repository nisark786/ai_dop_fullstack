"""
Tests for GET /api/health

Covers:
    - HTTP 200 response
    - Response schema validation
    - Healthy path (DB reachable)
    - Degraded path (DB failure injected)
"""

from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError


class TestHealthEndpoint:
    """Tests for the system health check endpoint."""

    def test_health_returns_200(self, client: TestClient) -> None:
        """GET /api/health must return HTTP 200."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_response_contains_required_fields(self, client: TestClient) -> None:
        """Response body must contain status, database, application, and version."""
        response = client.get("/api/health")
        body = response.json()

        assert "status" in body
        assert "database" in body
        assert "application" in body
        assert "version" in body

    def test_health_database_connected_when_db_reachable(self, client: TestClient) -> None:
        """When the DB session executes successfully, database field must be 'connected'."""
        response = client.get("/api/health")
        body = response.json()

        assert body["database"] == "connected"

    def test_health_status_healthy_when_db_connected(self, client: TestClient) -> None:
        """Overall status must be 'healthy' when database is 'connected'."""
        response = client.get("/api/health")
        body = response.json()

        assert body["status"] == "healthy"

    def test_health_application_name_populated(self, client: TestClient) -> None:
        """application field must be a non-empty string."""
        response = client.get("/api/health")
        body = response.json()

        assert isinstance(body["application"], str)
        assert len(body["application"]) > 0

    def test_health_version_populated(self, client: TestClient) -> None:
        """version field must be a non-empty string."""
        response = client.get("/api/health")
        body = response.json()

        assert isinstance(body["version"], str)
        assert len(body["version"]) > 0

    def test_health_degraded_when_db_raises(self) -> None:
        """
        When the DB session raises OperationalError during the ping,
        status must be 'degraded' and database must be 'unreachable'.

        We use a fresh TestClient with a dependency override that simulates
        a failing DB session — isolated from the shared client fixture.
        """
        from app.core.database import get_database_session
        from app.main import app

        def _broken_db():
            session = MagicMock()
            session.execute.side_effect = OperationalError(
                statement="SELECT 1",
                params={},
                orig=Exception("simulated connection failure"),
            )
            yield session

        app.dependency_overrides[get_database_session] = _broken_db
        try:
            with TestClient(app) as broken_client:
                response = broken_client.get("/api/health")
                body = response.json()

                assert response.status_code == 200
                assert body["status"] == "degraded"
                assert body["database"] == "unreachable"
        finally:
            app.dependency_overrides.clear()
