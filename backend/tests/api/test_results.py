"""
Tests for Results API endpoints.

Endpoints:
    GET  /api/results              — list crawled results with filters & pagination
    POST /api/results/{id}/promote — promote verified staging school to production
    GET  /api/results/export/csv   — export results to CSV
    GET  /api/results/export/excel — export results to Excel (.xlsx)
    GET  /api/results/export/html  — export results to HTML report
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.schools import Schools
from tests.factories import make_batch, make_metadata_output, make_staging_school


class TestListResults:
    """Tests for GET /api/results."""

    def test_list_results_empty(self, client: TestClient) -> None:
        """Returns valid ResultsListResponse schema even when table is empty."""
        response = client.get("/api/results")
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
        assert "summary" in data
        assert data["summary"]["total_records"] >= 0

    def test_list_results_with_staging_record(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Staging schools with metadata outputs appear in results with summary metrics."""
        batch = make_batch(db_session, name="Results Test Batch")
        staging = make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Results Elementary",
            district="Austin ISD",
            status="verified",
        )
        make_metadata_output(
            db_session,
            staging_school_id=staging.id,
            batch_id=batch.id,
            overall_score=88.0,
            extracted_fields={"phone": "512-555-8888", "grades": ["K", "5"]},
        )
        db_session.flush()

        response = client.get(f"/api/results?batch_id={batch.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_records"] >= 1
        assert data["summary"]["verified_count"] >= 1
        assert any(r["school_name"] == "Results Elementary" for r in data["records"])

    def test_list_results_filter_by_status(self, client: TestClient, db_session: Session) -> None:
        """Filters results by status badge category."""
        batch = make_batch(db_session, name="Status Filter Batch")
        make_staging_school(
            db_session, batch_id=batch.id, name="Verified School", status="verified"
        )
        make_staging_school(
            db_session, batch_id=batch.id, name="Needs Review School", status="needs_review"
        )
        db_session.flush()

        response = client.get(f"/api/results?batch_id={batch.id}&status=verified")
        assert response.status_code == 200
        records = response.json()["records"]
        assert all(r["status"] == "Verified" for r in records)

    def test_list_results_search_filter(self, client: TestClient, db_session: Session) -> None:
        """Search query filters results by school name or district."""
        batch = make_batch(db_session, name="Search Results Batch")
        unique_term = f"SearchMatch{uuid.uuid4().hex[:6]}"
        make_staging_school(db_session, batch_id=batch.id, name=f"School {unique_term}")
        db_session.flush()

        response = client.get(f"/api/results?search={unique_term}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["records"]) >= 1
        assert any(unique_term in r["school_name"] for r in data["records"])

    def test_list_results_pagination(self, client: TestClient, db_session: Session) -> None:
        """Limit and offset paginate results correctly."""
        batch = make_batch(db_session, name="Pagination Batch")
        for i in range(5):
            make_staging_school(db_session, batch_id=batch.id, name=f"School {i}")
        db_session.flush()

        response = client.get(f"/api/results?batch_id={batch.id}&limit=2&offset=0")
        assert response.status_code == 200
        assert len(response.json()["records"]) <= 2


class TestPromoteSchool:
    """Tests for POST /api/results/{staging_id}/promote."""

    def test_promote_staging_school_success(self, client: TestClient, db_session: Session) -> None:
        """Promotes staging school into production Schools table."""
        batch = make_batch(db_session, name="Promotion Batch")
        staging = make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Staging Candidate for Promotion",
            website="https://promote.edu",
            address="999 Production Way",
            district="Austin ISD",
            state="TX",
            status="verified",
        )
        db_session.flush()

        response = client.post(f"/api/results/{staging.id}/promote")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "published"
        assert "successfully promoted" in data["message"].lower()

        # Verify production record exists
        prod_school_id = data["production_school_id"]
        prod_school = db_session.query(Schools).filter(Schools.id == prod_school_id).first()
        assert prod_school is not None
        assert prod_school.name == "Staging Candidate for Promotion"
        assert prod_school.website == "https://promote.edu"

        # Verify staging school is marked promoted
        db_session.refresh(staging)
        assert staging.production_school_id == prod_school.id
        assert staging.status == "published"

    def test_promote_staging_school_not_found(self, client: TestClient) -> None:
        """Non-existent staging ID returns HTTP 404."""
        response = client.post(f"/api/results/{uuid.uuid4()}/promote")
        assert response.status_code == 404

    def test_promote_staging_school_invalid_uuid(self, client: TestClient) -> None:
        """Invalid UUID format returns HTTP 400."""
        response = client.post("/api/results/not-a-valid-uuid/promote")
        assert response.status_code == 400


class TestResultsExport:
    """Tests for multi-format export endpoints."""

    def test_export_results_csv(self, client: TestClient, db_session: Session) -> None:
        """GET /api/results/export/csv returns valid CSV download."""
        batch = make_batch(db_session, name="Export CSV Batch")
        make_staging_school(db_session, batch_id=batch.id, name="Export CSV School")
        db_session.flush()

        response = client.get(f"/api/results/export/csv?batch_id={batch.id}")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "attachment" in response.headers["content-disposition"]
        assert "results_info.csv" in response.headers["content-disposition"]
        assert "School Name" in response.text
        assert "Export CSV School" in response.text

    def test_export_results_excel(self, client: TestClient, db_session: Session) -> None:
        """GET /api/results/export/excel returns XLSX spreadsheet download."""
        batch = make_batch(db_session, name="Export Excel Batch")
        make_staging_school(db_session, batch_id=batch.id, name="Export Excel School")
        db_session.flush()

        response = client.get(f"/api/results/export/excel?batch_id={batch.id}")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats" in response.headers["content-type"]
        assert "results_info.xlsx" in response.headers["content-disposition"]
        assert len(response.content) > 100

    def test_export_results_html(self, client: TestClient, db_session: Session) -> None:
        """GET /api/results/export/html returns HTML report."""
        batch = make_batch(db_session, name="Export HTML Batch")
        make_staging_school(db_session, batch_id=batch.id, name="Export HTML School")
        db_session.flush()

        response = client.get(f"/api/results/export/html?batch_id={batch.id}")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "<!DOCTYPE html>" in response.text
        assert "Export HTML School" in response.text
