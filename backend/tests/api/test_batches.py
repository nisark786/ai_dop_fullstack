"""
Tests for Batches API endpoints.

Endpoints:
    GET    /api/batches                     — list active batches
    POST   /api/batches/upload-preview      — preview and validate intake file
    POST   /api/batches/upload-confirm      — commit batch and staging records
    GET    /api/batches/template            — download XLSX intake template
    GET    /api/batches/trash               — list soft-deleted batches
    POST   /api/batches/trash/purge-expired — purge expired batches from trash
    GET    /api/batches/{id}                — get full batch detail
    PATCH  /api/batches/{id}                — update name/description
    DELETE /api/batches/{id}                — soft-delete batch
    POST   /api/batches/{id}/restore        — restore trashed batch
    DELETE /api/batches/{id}/permanent      — permanently purge batch
    POST   /api/batches/{id}/schools        — add school to batch
    DELETE /api/batches/{id}/schools/{sid}  — drop school from batch
    POST   /api/batches/{id}/run-metadata-agent — trigger metadata agent
"""

import io
import uuid
from datetime import UTC, datetime, timedelta

import openpyxl
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.batch import BatchModel
from app.models.staging_school import StagingSchoolModel
from tests.factories import make_batch, make_school, make_staging_school


class TestListBatches:
    """Tests for GET /api/batches."""

    def test_list_batches_returns_200(self, client: TestClient) -> None:
        """GET /api/batches returns HTTP 200 and a list."""
        response = client.get("/api/batches")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_batches_search_filter(self, client: TestClient, db_session: Session) -> None:
        """Search query filters batches by name."""
        unique_name = f"AlphaBatch-{uuid.uuid4().hex[:6]}"
        make_batch(db_session, name=unique_name)
        db_session.flush()

        response = client.get(f"/api/batches?search={unique_name}")
        assert response.status_code == 200
        items = response.json()
        assert len(items) >= 1
        assert any(b["name"] == unique_name for b in items)

    def test_list_batches_status_filter(self, client: TestClient, db_session: Session) -> None:
        """Status filter matches batch status."""
        marker = f"StatusTest-{uuid.uuid4().hex[:4]}"
        make_batch(db_session, name=f"{marker} Processing", status="processing")
        make_batch(db_session, name=f"{marker} Ready", status="ready")
        db_session.flush()

        response = client.get(f"/api/batches?status=processing&search={marker}")
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert items[0]["status"] == "processing"

    def test_list_batches_excludes_trashed(self, client: TestClient, db_session: Session) -> None:
        """Soft-deleted batches are excluded from active list by default."""
        marker = f"TrashEx-{uuid.uuid4().hex[:6]}"
        make_batch(db_session, name=f"{marker} Active")
        make_batch(
            db_session, name=f"{marker} Trashed", deleted_at=datetime.now(UTC), status="trashed"
        )
        db_session.flush()

        response = client.get(f"/api/batches?search={marker}")
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert items[0]["name"] == f"{marker} Active"


class TestBatchTemplateAndUpload:
    """Tests for template download and upload preview."""

    def test_download_excel_template(self, client: TestClient) -> None:
        """GET /api/batches/template returns XLSX file attachment."""
        response = client.get("/api/batches/template")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats" in response.headers["content-type"]
        assert "schoolpath_batch_intake_template.xlsx" in response.headers["content-disposition"]
        assert len(response.content) > 100

    def test_upload_preview_csv(self, client: TestClient) -> None:
        """POST /api/batches/upload-preview validates uploaded CSV file."""
        csv_content = (
            b"Name,Website,Address,District\nPreview School,https://preview.edu,123 Main,Austin\n"
        )
        files = {"file": ("intake.csv", csv_content, "text/csv")}

        response = client.post("/api/batches/upload-preview", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 1
        assert data["valid_rows_count"] == 1
        assert data["invalid_rows_count"] == 0
        assert len(data["rows"]) == 1
        assert data["rows"][0]["name"] == "Preview School"

    def test_upload_preview_excel(self, client: TestClient) -> None:
        """POST /api/batches/upload-preview validates uploaded Excel file."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Name", "Address"])
        ws.append(["Excel Academy", "456 Oak Way"])
        buf = io.BytesIO()
        wb.save(buf)

        files = {
            "file": (
                "intake.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        response = client.post("/api/batches/upload-preview", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 1
        assert data["valid_rows_count"] == 1
        assert data["rows"][0]["name"] == "Excel Academy"

    def test_upload_preview_detects_duplicates(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Upload preview flags rows that match existing schools."""
        unique_domain = f"dupcheck-{uuid.uuid4().hex[:6]}.edu"
        make_school(db_session, name="Existing Dup School", website=f"https://{unique_domain}")
        db_session.flush()

        csv_content = f"Name,Website,Address\nDuplicate Candidate,https://www.{unique_domain},123 Main\n".encode()
        files = {"file": ("intake.csv", csv_content, "text/csv")}

        response = client.post("/api/batches/upload-preview", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["duplicates_count"] == 1
        assert data["rows"][0]["potential_duplicate"] is not None
        assert data["rows"][0]["selected_action"] == "link"


class TestConfirmBatchCreation:
    """Tests for POST /api/batches/upload-confirm."""

    def test_confirm_batch_creation_success(self, client: TestClient, db_session: Session) -> None:
        """Confirming batch creates BatchModel and associated StagingSchoolModel rows."""
        payload = {
            "name": f"Confirmed Batch {uuid.uuid4().hex[:4]}",
            "description": "Integration test batch",
            "source_type": "excel_upload",
            "rows": [
                {
                    "row_number": 1,
                    "name": "School 1",
                    "website": "https://s1.edu",
                    "address": "100 Ave",
                    "district": "ISD 1",
                    "state": "TX",
                    "action": "create",
                },
                {
                    "row_number": 2,
                    "name": "School 2",
                    "website": "https://s2.edu",
                    "address": "200 Ave",
                    "action": "create",
                },
            ],
        }

        response = client.post("/api/batches/upload-confirm", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "batch" in data
        assert data["batch"]["name"] == payload["name"]
        assert len(data["schools"]) == 2

        # Verify database state
        batch_id = data["batch"]["id"]
        stagings = (
            db_session.query(StagingSchoolModel)
            .filter(StagingSchoolModel.batch_id == batch_id)
            .all()
        )
        assert len(stagings) == 2


class TestBatchDetailAndUpdate:
    """Tests for GET and PATCH on /api/batches/{id}."""

    def test_get_batch_detail_success(self, client: TestClient, db_session: Session) -> None:
        """Retrieves full batch detail, member schools, and metadata."""
        batch = make_batch(db_session, name="Detail Inspection Batch")
        make_staging_school(db_session, batch_id=batch.id, name="Member Staging School")
        db_session.flush()

        response = client.get(f"/api/batches/{batch.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["batch"]["id"] == str(batch.id)
        assert len(data["schools"]) == 1
        assert data["schools"][0]["name"] == "Member Staging School"

    def test_get_batch_detail_not_found(self, client: TestClient) -> None:
        """Non-existent batch ID returns HTTP 404."""
        response = client.get(f"/api/batches/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_update_batch_name_and_description(
        self, client: TestClient, db_session: Session
    ) -> None:
        """PATCH updates name and description correctly."""
        batch = make_batch(db_session, name="Old Name", description="Old Desc")
        db_session.flush()

        payload = {"name": "New Updated Name", "description": "New Updated Desc"}
        response = client.patch(f"/api/batches/{batch.id}", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Updated Name"
        assert data["description"] == "New Updated Desc"

        db_session.refresh(batch)
        assert batch.name == "New Updated Name"


class TestBatchLifecycle:
    """Tests for soft-delete, restore, trash, purge, and permanent delete."""

    def test_soft_delete_and_restore_batch(self, client: TestClient, db_session: Session) -> None:
        """Soft-deletes batch to Trash Bucket, then restores it back to active."""
        batch = make_batch(db_session, name="Lifecycle Batch")
        db_session.flush()

        # 1. Soft-delete
        del_res = client.delete(f"/api/batches/{batch.id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "trashed"

        db_session.refresh(batch)
        assert batch.deleted_at is not None

        # 2. Check in trash
        trash_res = client.get("/api/batches/trash")
        assert trash_res.status_code == 200
        trash_ids = [b["id"] for b in trash_res.json()]
        assert str(batch.id) in trash_ids

        # 3. Restore
        restore_res = client.post(f"/api/batches/{batch.id}/restore")
        assert restore_res.status_code == 200
        assert restore_res.json()["status"] == "ready"

        db_session.refresh(batch)
        assert batch.deleted_at is None

    def test_permanent_delete_batch(self, client: TestClient, db_session: Session) -> None:
        """Permanently purges batch row from database."""
        batch = make_batch(db_session, name="Batch to Permanently Delete")
        b_id = str(batch.id)
        db_session.flush()

        response = client.delete(f"/api/batches/{b_id}/permanent")
        assert response.status_code == 200

        assert db_session.query(BatchModel).filter(BatchModel.id == b_id).first() is None

    def test_purge_expired_trash(self, client: TestClient, db_session: Session) -> None:
        """Purges batches in Trash Bucket older than retention threshold."""
        expired_date = datetime.now(UTC) - timedelta(days=45)
        make_batch(db_session, name="Expired Batch", deleted_at=expired_date, status="trashed")
        db_session.flush()

        response = client.post("/api/batches/trash/purge-expired?retention_days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["purged_count"] >= 1


class TestBatchSchoolMembership:
    """Tests for adding and dropping schools from batches."""

    def test_add_school_to_batch_success(self, client: TestClient, db_session: Session) -> None:
        """Adding a new school to a batch creates StagingSchoolModel and updates count."""
        batch = make_batch(db_session, name="Membership Batch", school_count=0)
        db_session.flush()

        payload = {
            "name": f"Added School {uuid.uuid4().hex[:4]}",
            "website": "https://added.edu",
            "address": "777 School Ln",
            "district": "Lone Star ISD",
            "state": "TX",
        }
        response = client.post(f"/api/batches/{batch.id}/schools", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["status"] == "pending"

        db_session.refresh(batch)
        assert batch.school_count == 1

    def test_add_school_validation_checks(self, client: TestClient, db_session: Session) -> None:
        """Rejects school name shorter than 2 chars or missing contact."""
        batch = make_batch(db_session, name="Validation Test Batch")
        db_session.flush()

        # Short name fails Pydantic schema validation (min_length=2)
        r1 = client.post(
            f"/api/batches/{batch.id}/schools", json={"name": "A", "address": "123 St"}
        )
        assert r1.status_code == 422

        # Missing both address and website fails Pydantic model_validator (requires website or address)
        r2 = client.post(f"/api/batches/{batch.id}/schools", json={"name": "Valid School"})
        assert r2.status_code == 422

    def test_add_school_duplicate_in_same_batch_raises_400(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Adding a school with the exact same name to the same batch returns 400."""
        batch = make_batch(db_session, name="Duplicate Check Batch")
        db_session.flush()

        payload = {"name": "Unique School Name", "address": "100 St"}
        r1 = client.post(f"/api/batches/{batch.id}/schools", json=payload)
        assert r1.status_code == 201

        r2 = client.post(f"/api/batches/{batch.id}/schools", json=payload)
        assert r2.status_code == 400
        assert "already a member" in r2.json()["detail"].lower()

    def test_drop_school_from_batch_staging(self, client: TestClient, db_session: Session) -> None:
        """Dropping a school soft-deletes the staging record and updates batch count."""
        batch = make_batch(db_session, name="Drop Test Batch", school_count=1)
        staging = make_staging_school(db_session, batch_id=batch.id, name="To Drop School")
        db_session.flush()

        response = client.delete(f"/api/batches/{batch.id}/schools/{staging.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["remaining_schools"] == 0

        db_session.refresh(staging)
        assert staging.deleted_at is not None

        db_session.refresh(batch)
        assert batch.school_count == 0


class TestRunMetadataAgentOnBatch:
    """Tests for POST /api/batches/{id}/run-metadata-agent."""

    def test_run_metadata_agent_success(self, client: TestClient, db_session: Session) -> None:
        """Queues metadata discovery agent across batch schools and returns AgentDispatchResponse."""
        batch = make_batch(db_session, name="Agent Run Batch", school_count=1)
        staging = make_staging_school(db_session, batch_id=batch.id, name="Agent Target School")
        db_session.flush()

        payload = {"scope": "batch"}
        response = client.post(f"/api/batches/{batch.id}/run-metadata-agent", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert data["job_id"].startswith("JOB-")
        assert data["batch_id"] == str(batch.id)
        assert data["status"] == "queued"
        assert data["target_count"] == 1

        # Staging school should now be queued
        db_session.refresh(staging)
        products = staging.metadata_json.get("products", {})
        assert products.get("info", {}).get("status") == "queued"

    def test_run_metadata_agent_not_found(self, client: TestClient) -> None:
        """Unknown batch ID returns HTTP 404."""
        response = client.post(
            f"/api/batches/{uuid.uuid4()}/run-metadata-agent", json={"scope": "batch"}
        )
        assert response.status_code == 404

    def test_run_metadata_agent_no_schools_returns_400(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Executing agent on an empty batch returns HTTP 400."""
        batch = make_batch(db_session, name="Empty Batch", school_count=0)
        db_session.flush()

        response = client.post(
            f"/api/batches/{batch.id}/run-metadata-agent", json={"scope": "batch"}
        )
        assert response.status_code == 400
        assert "no schools found" in response.json()["detail"].lower()
