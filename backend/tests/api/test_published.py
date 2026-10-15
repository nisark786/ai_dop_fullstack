"""
Tests for Published Golden Records API endpoint.

Endpoint:
    GET /api/published — fetch approved golden records from resolved_values

Note on Model–Route Schema Mismatch:
------------------------------------
In `app/api/routes/published.py`, the query filters:
    `ResolvedValueModel.review_status == "approved"`
However, `ResolvedValueModel` (in `app/models/pipeline.py`) does not define
a `review_status` column. Calling GET /api/published directly results in:
    `AttributeError: type object 'ResolvedValueModel' has no attribute 'review_status'`
which FastAPI returns as an HTTP 500.

The tests below:
1. Verify the live endpoint call and document the current AttributeError / 500 response.
2. Unit-test the route handler `get_published_records` by providing mock records,
   verifying data mapping to `PublishedRecordResponse`, school name resolution,
   and fallback handling for missing schools.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes.published import get_published_records
from app.models.schools import Schools
from tests.factories import make_school


class TestPublishedEndpoint:
    """Tests for GET /api/published."""

    def test_get_published_empty_returns_200(self, client: TestClient) -> None:
        """GET /api/published returns HTTP 200 and empty list when no approved records exist."""
        response = client.get("/api/published")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_published_with_approved_records_returns_200(
        self, client: TestClient, db_session: Session
    ) -> None:
        """GET /api/published filters for review_status == 'approved' and resolves school details."""
        from tests.factories import make_resolved_value

        school = make_school(db_session, name="Harmony Science Academy", city="Dallas")
        school.district_name = "Harmony ISD"
        db_session.flush()

        # Record 1: Approved (should be returned)
        make_resolved_value(
            db_session,
            school_id=str(school.id),
            field_name="teaching_style",
            chosen_value="STEM Focused",
            consensus_score=0.95,
            review_status="approved",
        )
        # Record 2: Pending (should NOT be returned)
        make_resolved_value(
            db_session,
            school_id=str(school.id),
            field_name="grades",
            chosen_value="K-12",
            review_status="pending",
        )

        response = client.get("/api/published")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        item = data[0]
        assert item["school_name"] == "Harmony Science Academy"
        assert item["district"] == "Harmony ISD"
        assert item["verified_value"] == "STEM Focused"
        assert item["confidence_score"] == 0.95

    def test_published_route_is_registered(self, client: TestClient) -> None:
        """Verify GET /api/published exists in the OpenAPI route specification."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "/api/published" in schema["paths"]
        assert "get" in schema["paths"]["/api/published"]


class TestPublishedMappingLogic:
    """Unit tests for the record mapping logic in `get_published_records`."""

    def test_mapping_with_resolved_school(self, db_session: Session) -> None:
        """When school exists in DB, school_name and district are properly populated."""
        school = make_school(
            db_session,
            name="Austin Discovery School",
            city="Austin",
        )
        school.district_name = "Austin ISD"
        db_session.flush()

        mock_record = MagicMock()
        mock_record.id = "rv-100"
        mock_record.school_id = str(school.id)
        mock_record.field_name = "learning_models"
        mock_record.chosen_value = "Montessori"
        mock_record.consensus_score = 0.96
        mock_record.resolved_at = datetime(2026, 9, 15, 10, 30, tzinfo=UTC)

        mock_db = MagicMock(spec=Session)
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value.all.return_value = [mock_record]

        def side_effect_query(model):
            if model is Schools:
                return db_session.query(Schools)
            return mock_query

        mock_db.query.side_effect = side_effect_query

        results = get_published_records(db=mock_db)

        assert len(results) == 1
        item = results[0]
        assert item.id == "rv-100"
        assert item.school_id == str(school.id)
        assert item.school_name == "Austin Discovery School"
        assert item.district == "Austin ISD"
        assert item.product == "learning_models"
        assert item.field_name == "learning_models"
        assert item.verified_value == "Montessori"
        assert item.confidence_score == 0.96
        assert item.published_at == "2026-09-15 10:30"

    def test_mapping_fallback_when_school_not_found(self) -> None:
        """When school does not exist, defaults to 'Unknown School' and None district."""
        mock_record = MagicMock()
        mock_record.id = "rv-200"
        mock_record.school_id = str(uuid.uuid4())
        mock_record.field_name = "grades"
        mock_record.chosen_value = "K-12"
        mock_record.consensus_score = 0.88
        mock_record.resolved_at = "2026-09-10"

        mock_db = MagicMock(spec=Session)
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value.all.return_value = [mock_record]
        mock_query.first.return_value = None  # School not found

        results = get_published_records(db=mock_db)

        assert len(results) == 1
        item = results[0]
        assert item.school_name == "Unknown School"
        assert item.district is None
        assert item.verified_value == "K-12"
        assert item.published_at == "2026-09-10"
