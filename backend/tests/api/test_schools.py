"""
Tests for Schools API endpoints.

Endpoints:
    GET    /api/schools/stats               — summary metrics
    GET    /api/schools                     — paginated search, filter, and sort
    GET    /api/schools/trash               — list quarantined schools
    POST   /api/schools/trash/purge-expired — delete schools past retention
    GET    /api/schools/{id}                — single school details
    DELETE /api/schools/{id}                — soft-delete school
    POST   /api/schools/{id}/restore        — restore quarantined school
    DELETE /api/schools/{id}/permanent      — permanently delete school
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.schools import Schools
from tests.factories import make_batch, make_school, make_staging_school


class TestSchoolStats:
    """Tests for GET /api/schools/stats."""

    def test_get_school_stats_returns_200(self, client: TestClient) -> None:
        """GET /api/schools/stats returns 200 and schema fields."""
        response = client.get("/api/schools/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_schools" in data
        assert "active_schools" in data
        assert "inactive_schools" in data
        assert "verified_schools" in data
        assert "pending_schools" in data

    def test_get_school_stats_counts_active_and_inactive(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Stats accurately reflect active vs inactive school states."""
        make_school(db_session, name=f"Active-{uuid.uuid4().hex[:4]}", is_active=True)
        make_school(db_session, name=f"Inactive-{uuid.uuid4().hex[:4]}", is_active=False)
        db_session.flush()

        response = client.get("/api/schools/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_schools"] >= 2
        assert data["active_schools"] >= 1
        assert data["inactive_schools"] >= 1

    def test_get_school_stats_counts_verification_statuses(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Counts verified and pending verification statuses correctly."""
        make_school(
            db_session,
            name=f"Verified-{uuid.uuid4().hex[:4]}",
            profile_verification_status="verified",
        )
        make_school(
            db_session,
            name=f"Pending-{uuid.uuid4().hex[:4]}",
            profile_verification_status="pending",
        )
        db_session.flush()

        response = client.get("/api/schools/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["verified_schools"] >= 1
        assert data["pending_schools"] >= 1

    def test_get_school_stats_excludes_soft_deleted(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Soft-deleted schools are excluded from stats calculations."""
        res_before = client.get("/api/schools/stats").json()
        total_before = res_before["total_schools"]

        make_school(
            db_session,
            name=f"Deleted-{uuid.uuid4().hex[:4]}",
            deleted_at=datetime.now(UTC),
        )
        db_session.flush()

        res_after = client.get("/api/schools/stats").json()
        assert res_after["total_schools"] == total_before


class TestListSchools:
    """Tests for GET /api/schools."""

    def test_list_schools_returns_200(self, client: TestClient) -> None:
        """Returns paginated schools response with items array."""
        response = client.get("/api/schools")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data

    def test_list_schools_pagination(self, client: TestClient, db_session: Session) -> None:
        """Respects page and page_size query parameters."""
        for i in range(5):
            make_school(db_session, name=f"Pagination School {i} {uuid.uuid4().hex[:4]}")
        db_session.flush()

        response = client.get("/api/schools?page=1&page_size=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 2
        assert data["page"] == 1
        assert data["page_size"] == 2

    def test_list_schools_filter_status_active(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Filtering by status=active returns only active schools."""
        marker = f"ActiveFilter-{uuid.uuid4().hex[:6]}"
        make_school(db_session, name=f"{marker} Active", is_active=True)
        make_school(db_session, name=f"{marker} Inactive", is_active=False)
        db_session.flush()

        response = client.get(f"/api/schools?status=active&search={marker}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["is_active"] is True

    def test_list_schools_filter_status_inactive(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Filtering by status=inactive returns only inactive schools."""
        marker = f"InactiveFilter-{uuid.uuid4().hex[:6]}"
        make_school(db_session, name=f"{marker} Active", is_active=True)
        make_school(db_session, name=f"{marker} Inactive", is_active=False)
        db_session.flush()

        response = client.get(f"/api/schools?status=inactive&search={marker}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["is_active"] is False

    def test_list_schools_filter_missing_website(
        self, client: TestClient, db_session: Session
    ) -> None:
        """missing_website=true returns schools where website is None or empty."""
        marker = f"MissingWeb-{uuid.uuid4().hex[:6]}"
        make_school(db_session, name=f"{marker} NoWeb", website=None)
        make_school(db_session, name=f"{marker} HasWeb", website="https://has-web.edu")
        db_session.flush()

        response = client.get(f"/api/schools?missing_website=true&search={marker}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == f"{marker} NoWeb"

    def test_list_schools_search(self, client: TestClient, db_session: Session) -> None:
        """Search query matches against school name."""
        unique_term = f"UniqueSearchTerm{uuid.uuid4().hex[:6]}"
        make_school(db_session, name=f"School with {unique_term}")
        db_session.flush()

        response = client.get(f"/api/schools?search={unique_term}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert any(unique_term in s["name"] for s in data["items"])

    def test_list_schools_sort_by_name(self, client: TestClient, db_session: Session) -> None:
        """Sorts schools by name ascending and descending."""
        prefix = f"SortTest{uuid.uuid4().hex[:4]}"
        make_school(db_session, name=f"{prefix} ZZZ School")
        make_school(db_session, name=f"{prefix} AAA School")
        db_session.flush()

        res_asc = client.get(f"/api/schools?search={prefix}&sort_by=name&sort_order=asc")
        assert res_asc.status_code == 200
        items_asc = res_asc.json()["items"]
        assert len(items_asc) >= 2
        assert items_asc[0]["name"].endswith("AAA School")

        res_desc = client.get(f"/api/schools?search={prefix}&sort_by=name&sort_order=desc")
        assert res_desc.status_code == 200
        items_desc = res_desc.json()["items"]
        assert items_desc[0]["name"].endswith("ZZZ School")

    def test_list_schools_excludes_soft_deleted(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Soft-deleted schools do not appear in normal list."""
        marker = f"SoftDel-{uuid.uuid4().hex[:6]}"
        make_school(db_session, name=f"{marker} Active")
        make_school(db_session, name=f"{marker} Trashed", deleted_at=datetime.now(UTC))
        db_session.flush()

        response = client.get(f"/api/schools?search={marker}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == f"{marker} Active"


class TestGetSchoolById:
    """Tests for GET /api/schools/{id}."""

    def test_get_school_by_id_success(self, client: TestClient, db_session: Session) -> None:
        """Retrieves single school by UUID with complete schema details."""
        school = make_school(
            db_session,
            name="Saint Andrews Episcopal",
            city="Austin",
            state="TX",
            phone="512-555-0199",
        )
        db_session.flush()

        response = client.get(f"/api/schools/{school.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(school.id)
        assert data["name"] == "Saint Andrews Episcopal"
        assert data["city"] == "Austin"
        assert data["phone"] == "512-555-0199"

    def test_get_school_by_id_invalid_uuid_returns_400(self, client: TestClient) -> None:
        """Invalid UUID format returns HTTP 400."""
        response = client.get("/api/schools/not-a-valid-uuid")
        assert response.status_code == 400
        assert "invalid uuid format" in response.json()["detail"].lower()

    def test_get_school_by_id_not_found_returns_404(self, client: TestClient) -> None:
        """Valid but non-existent UUID returns HTTP 404."""
        random_uuid = str(uuid.uuid4())
        response = client.get(f"/api/schools/{random_uuid}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestDeleteSchool:
    """Tests for DELETE /api/schools/{id} (soft-delete)."""

    def test_delete_production_school_soft_deletes(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Soft-deletes production school, marking deleted_at and is_active=False."""
        school = make_school(db_session, name="Production School to Trash")
        db_session.flush()

        response = client.delete(f"/api/schools/{school.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["school_id"] == str(school.id)
        assert data["status"] == "trashed"

        # Verify in DB
        db_session.refresh(school)
        assert school.deleted_at is not None
        assert school.is_active is False

    def test_delete_staging_school_soft_deletes(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Soft-deletes staging school and decrements batch school_count."""
        batch = make_batch(db_session, name="Batch with Staging School", school_count=1)
        staging = make_staging_school(db_session, batch_id=batch.id, name="Staging to Trash")
        db_session.flush()

        response = client.delete(f"/api/schools/{staging.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["school_id"] == str(staging.id)
        assert data["status"] == "trashed"

        db_session.refresh(staging)
        assert staging.deleted_at is not None

        db_session.refresh(batch)
        assert batch.school_count == 0

    def test_delete_school_invalid_uuid_returns_400(self, client: TestClient) -> None:
        """DELETE with invalid UUID returns HTTP 400."""
        response = client.delete("/api/schools/not-a-uuid")
        assert response.status_code == 400

    def test_delete_school_not_found_returns_404(self, client: TestClient) -> None:
        """DELETE non-existent school returns HTTP 404."""
        response = client.delete(f"/api/schools/{uuid.uuid4()}")
        assert response.status_code == 404


class TestRestoreSchool:
    """Tests for POST /api/schools/{id}/restore."""

    def test_restore_production_school(self, client: TestClient, db_session: Session) -> None:
        """Restores soft-deleted production school, setting is_active=True and deleted_at=None."""
        school = make_school(
            db_session,
            name="School to Restore",
            is_active=False,
            deleted_at=datetime.now(UTC),
        )
        db_session.flush()

        response = client.post(f"/api/schools/{school.id}/restore")
        assert response.status_code == 200
        data = response.json()
        assert data["school_id"] == str(school.id)
        assert data["status"] == "restored"

        db_session.refresh(school)
        assert school.deleted_at is None
        assert school.is_active is True

    def test_restore_staging_school(self, client: TestClient, db_session: Session) -> None:
        """Restores soft-deleted staging school and increments batch count."""
        batch = make_batch(db_session, name="Batch Restore Test", school_count=0)
        staging = make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Staging to Restore",
            deleted_at=datetime.now(UTC),
        )
        db_session.flush()

        response = client.post(f"/api/schools/{staging.id}/restore")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "restored"

        db_session.refresh(staging)
        assert staging.deleted_at is None

        db_session.refresh(batch)
        assert batch.school_count == 1

    def test_restore_school_not_found_returns_404(self, client: TestClient) -> None:
        """Restoring non-existent or non-trashed school returns HTTP 404."""
        response = client.post(f"/api/schools/{uuid.uuid4()}/restore")
        assert response.status_code == 404


class TestTrashAndPermanentDelete:
    """Tests for Trash list, permanent delete, and purge."""

    def test_list_trash_schools(self, client: TestClient, db_session: Session) -> None:
        """Quarantined schools appear in /trash with days_remaining."""
        unique_name = f"TrashedItem-{uuid.uuid4().hex[:6]}"
        make_school(db_session, name=unique_name, deleted_at=datetime.now(UTC))
        db_session.flush()

        response = client.get(f"/api/schools/trash?search={unique_name}")
        assert response.status_code == 200
        items = response.json()
        assert len(items) >= 1
        trashed_item = next(item for item in items if item["name"] == unique_name)
        assert trashed_item["days_remaining"] <= 30
        assert trashed_item["deleted_at"] is not None

    def test_permanent_delete_school(self, client: TestClient, db_session: Session) -> None:
        """Permanently purges school row from database."""
        school = make_school(db_session, name="School to Purge Forever")
        school_id = school.id
        db_session.flush()

        response = client.delete(f"/api/schools/{school_id}/permanent")
        assert response.status_code == 200
        assert response.json()["status"] == "purged"

        # Verify not in database
        assert db_session.query(Schools).filter(Schools.id == school_id).first() is None

    def test_purge_expired_trash_schools(self, client: TestClient, db_session: Session) -> None:
        """Purges schools that have exceeded the retention threshold."""
        expired_date = datetime.now(UTC) - timedelta(days=45)
        recent_date = datetime.now(UTC) - timedelta(days=5)

        make_school(db_session, name="Expired School", deleted_at=expired_date)
        recent = make_school(db_session, name="Recent School", deleted_at=recent_date)
        db_session.flush()

        response = client.post("/api/schools/trash/purge-expired?retention_days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["purged_count"] >= 1

        # Recent school should still exist
        assert db_session.query(Schools).filter(Schools.id == recent.id).first() is not None
