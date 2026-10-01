"""Unit tests for the BatchService domain orchestrator.

Covers:
- File upload intake preview generation & size/row limits
- Confirm and create batch (staging school isolation)
- Batch listing with dynamic count synchronization
- Batch update, soft-delete, restore, permanent-delete
- Adding and dropping schools from batches
- Purging expired batches from trash
- Batch detail fetching (staging and legacy models)
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.models.batch import BatchModel, BatchSchoolModel
from app.models.staging_school import StagingSchoolModel
from app.schemas.batch import (
    AddBatchSchoolRequest,
    BatchConfirmCreateRequest,
    BatchConfirmRow,
    BatchUpdateRequest,
)
from app.services.batches.batch_service import BatchService
from app.services.batches.file_parser import MAX_FILE_BYTES, MAX_INTAKE_ROWS
from tests.factories import days_ago, make_batch, make_school, make_staging_school


class TestBatchServiceUploadPreview:
    """Tests for BatchService.generate_upload_preview."""

    def test_generate_upload_preview_csv_success(self, db_session: Session):
        csv_content = b"School Name,Website,Address,District,State\nSummit High,https://summit.edu,123 Peak Rd,Summit ISD,CO\n"
        preview = BatchService.generate_upload_preview(csv_content, "schools.csv", db_session)

        assert preview.filename == "schools.csv"
        assert preview.total_rows == 1
        assert preview.valid_rows_count == 1
        assert preview.invalid_rows_count == 0
        assert len(preview.rows) == 1
        assert preview.rows[0].name == "Summit High"

    def test_generate_upload_preview_exceeds_max_bytes_raises(self, db_session: Session):
        oversized = b"x" * (MAX_FILE_BYTES + 1)
        with pytest.raises(ValueError, match="maximum size limit"):
            BatchService.generate_upload_preview(oversized, "huge.csv", db_session)

    def test_generate_upload_preview_exceeds_max_rows_raises(
        self, db_session: Session, monkeypatch
    ):
        # Mock parser returning more rows than allowed
        fake_rows = [
            {"School Name": f"School {i}", "Website": "https://example.com"}
            for i in range(MAX_INTAKE_ROWS + 5)
        ]
        monkeypatch.setattr(
            "app.services.batches.file_parser.BatchFileParser.parse_csv",
            lambda _: fake_rows,
        )

        with pytest.raises(ValueError, match="maximum allowed is"):
            BatchService.generate_upload_preview(b"School Name\nsome row", "test.csv", db_session)


class TestBatchServiceConfirmCreate:
    """Tests for BatchService.confirm_and_create_batch."""

    def test_confirm_and_create_batch_success(self, db_session: Session):
        payload = BatchConfirmCreateRequest(
            name="Denver Metro Intake",
            description="Testing batch creation",
            source_type="csv_upload",
            rows=[
                BatchConfirmRow(
                    row_index=1,
                    action="create",
                    name="Apex Academy",
                    website="https://apex.edu",
                    address="100 Peak Ave",
                    district="Denver Public Schools",
                    state="CO",
                    phone="(303) 555-0101",
                    email="contact@apex.edu",
                    type=["charter"],
                    grades=["9th grade", "10th grade", "11th grade", "12th grade"],
                ),
                BatchConfirmRow(
                    row_index=2,
                    action="create",
                    name="Beacon Prep",
                    website="https://beacon.edu",
                    address="200 Light St",
                    district="Denver Public Schools",
                    state="CO",
                ),
            ],
        )

        detail = BatchService.confirm_and_create_batch(db_session, payload, created_by="tester")

        assert detail.batch.name == "Denver Metro Intake"
        assert detail.batch.school_count == 2
        assert detail.batch.status == "ready"
        assert len(detail.schools) == 2

        # Verify staging records in DB
        stagings = (
            db_session.query(StagingSchoolModel)
            .filter(StagingSchoolModel.batch_id == detail.batch.id)
            .all()
        )
        assert len(stagings) == 2
        assert {s.name for s in stagings} == {"Apex Academy", "Beacon Prep"}
        for s in stagings:
            assert s.metadata_json["products"]["info"]["status"] == "not_run"

        apex = next(s for s in stagings if s.name == "Apex Academy")
        assert apex.phone == "(303) 555-0101"
        assert apex.email == "contact@apex.edu"
        assert apex.type == ["charter"]
        assert apex.grades == ["9th grade", "10th grade", "11th grade", "12th grade"]
        assert apex.source_data.get("original_grades") == [
            "9th grade",
            "10th grade",
            "11th grade",
            "12th grade",
        ]

    def test_confirm_and_create_batch_with_linked_school(self, db_session: Session):
        prod_school = make_school(db_session, name="Existing Golden Academy")

        payload = BatchConfirmCreateRequest(
            name="Link Intake",
            source_type="excel_upload",
            rows=[
                BatchConfirmRow(
                    row_index=1,
                    action="link",
                    link_school_id=prod_school.id,
                    name="Existing Golden Academy",
                    website="https://existing.edu",
                )
            ],
        )

        detail = BatchService.confirm_and_create_batch(db_session, payload)
        staging = (
            db_session.query(StagingSchoolModel)
            .filter(StagingSchoolModel.batch_id == detail.batch.id)
            .first()
        )
        assert staging is not None
        assert staging.production_school_id == prod_school.id


class TestBatchServiceListBatches:
    """Tests for BatchService.list_batches and list_trash_batches."""

    def test_list_batches_dynamic_count_sync(self, db_session: Session):
        batch = make_batch(db_session, name="Count Sync Batch", school_count=999)
        # Add 2 staging schools
        make_staging_school(db_session, batch_id=batch.id, name="S1")
        make_staging_school(db_session, batch_id=batch.id, name="S2")

        batches = BatchService.list_batches(
            db_session, status=None, search=None, limit=10, offset=0
        )
        found = next((b for b in batches if b.id == batch.id), None)
        assert found is not None
        assert found.school_count == 2  # Dynamically corrected from 999 to 2

    def test_list_batches_filters_trash_and_status(self, db_session: Session):
        active_b = make_batch(db_session, name="Active Batch", status="ready")
        trashed_b = make_batch(
            db_session,
            name="Trashed Batch",
            status="trashed",
            deleted_at=datetime.now(UTC),
        )

        # Normal list should exclude trashed
        active_list = BatchService.list_batches(
            db_session, status=None, search=None, limit=10, offset=0, include_trash=False
        )
        active_ids = {b.id for b in active_list}
        assert active_b.id in active_ids
        assert trashed_b.id not in active_ids

        # Trash list should only include trashed
        trash_list = BatchService.list_trash_batches(db_session)
        trash_ids = {b.id for b in trash_list}
        assert trashed_b.id in trash_ids
        assert active_b.id not in trash_ids


class TestBatchServiceLifecycle:
    """Tests for update, soft-delete, restore, and permanent-delete."""

    def test_update_batch_success(self, db_session: Session):
        batch = make_batch(db_session, name="Old Name", description="Old Desc")
        update_req = BatchUpdateRequest(name="New Name", description="New Desc")

        updated = BatchService.update_batch(db_session, str(batch.id), update_req)
        assert updated.name == "New Name"
        assert updated.description == "New Desc"

    def test_update_batch_not_found_raises(self, db_session: Session):
        with pytest.raises(ValueError, match="not found"):
            BatchService.update_batch(db_session, str(uuid4()), BatchUpdateRequest(name="Whatever"))

    def test_soft_delete_and_restore_batch(self, db_session: Session):
        batch = make_batch(db_session, name="To Delete Batch", status="ready")

        # Soft delete
        deleted = BatchService.soft_delete_batch(db_session, str(batch.id))
        assert deleted.status == "trashed"
        assert deleted.deleted_at is not None

        # Restore
        restored = BatchService.restore_batch(db_session, str(batch.id))
        assert restored.status == "ready"
        assert restored.deleted_at is None

    def test_permanent_delete_batch(self, db_session: Session):
        batch = make_batch(db_session, name="Permanently Delete Me")
        result = BatchService.permanent_delete_batch(db_session, str(batch.id))
        assert "permanently deleted" in result["message"]

        assert db_session.query(BatchModel).filter(BatchModel.id == batch.id).first() is None


class TestBatchServiceAddDropSchool:
    """Tests for adding and dropping schools from a batch."""

    def test_add_school_to_batch_success(self, db_session: Session):
        batch = make_batch(db_session, name="Target Batch", school_count=0)
        req = AddBatchSchoolRequest(
            name="New Academy",
            website="https://newacademy.edu",
            address="456 Elm St",
            district="Austin ISD",
            state="TX",
        )

        item = BatchService.add_school_to_batch(db_session, str(batch.id), req)
        assert item.name == "New Academy"
        assert item.website == "https://newacademy.edu"
        assert batch.school_count == 1

    def test_add_school_to_trashed_batch_raises(self, db_session: Session):
        batch = make_batch(
            db_session, name="Trash Batch", deleted_at=datetime.now(UTC), status="trashed"
        )
        req = AddBatchSchoolRequest(name="Valid School", website="https://school.edu")
        with pytest.raises(ValueError, match="Cannot add school to a trashed batch"):
            BatchService.add_school_to_batch(db_session, str(batch.id), req)

    def test_add_school_validation_failures(self, db_session: Session):
        batch = make_batch(db_session, name="Test Batch")

        # Name too short caught by Pydantic
        with pytest.raises(Exception, match="at least 2 characters"):
            AddBatchSchoolRequest(name="A", website="https://a.edu")

        # Missing both website and address caught by Pydantic
        with pytest.raises(Exception, match="Either website or address must be provided"):
            AddBatchSchoolRequest(name="No Contact School")

        # Duplicate school name in same batch caught by BatchService
        make_staging_school(db_session, batch_id=batch.id, name="Existing School")
        with pytest.raises(ValueError, match="already a member"):
            BatchService.add_school_to_batch(
                db_session,
                str(batch.id),
                AddBatchSchoolRequest(name="Existing School", website="https://exist.edu"),
            )

    def test_drop_school_from_batch_staging(self, db_session: Session):
        batch = make_batch(db_session, name="Drop Test Batch", school_count=1)
        staging = make_staging_school(db_session, batch_id=batch.id, name="To Drop")

        result = BatchService.drop_school_from_batch(db_session, str(batch.id), staging.id)
        assert "moved to trash" in result["message"]
        assert result["remaining_schools"] == 0

        # Staging school should now be soft-deleted
        assert staging.deleted_at is not None

    def test_drop_school_from_batch_legacy(self, db_session: Session):
        batch = make_batch(db_session, name="Legacy Drop Batch", school_count=1)
        school = make_school(db_session, name="Legacy School")
        bs = BatchSchoolModel(batch_id=batch.id, school_id=school.id, status="ready")
        db_session.add(bs)
        db_session.commit()

        result = BatchService.drop_school_from_batch(db_session, str(batch.id), school.id)
        assert "successfully dropped" in result["message"]
        assert result["remaining_schools"] == 0


class TestBatchServicePurgeAndDetail:
    """Tests for purge_expired_trash and get_batch_detail."""

    def test_purge_expired_trash(self, db_session: Session):
        # 35 days ago -> expired (retention=30)
        expired_batch = make_batch(
            db_session,
            name="Old Expired Batch",
            deleted_at=days_ago(35),
            status="trashed",
        )
        # 10 days ago -> within retention
        recent_trash = make_batch(
            db_session,
            name="Recent Trash Batch",
            deleted_at=days_ago(10),
            status="trashed",
        )

        purged_count = BatchService.purge_expired_trash(db_session, retention_days=30)
        assert purged_count == 1

        assert (
            db_session.query(BatchModel).filter(BatchModel.id == expired_batch.id).first() is None
        )
        assert (
            db_session.query(BatchModel).filter(BatchModel.id == recent_trash.id).first()
            is not None
        )

    def test_get_batch_detail_staging(self, db_session: Session):
        batch = make_batch(db_session, name="Detail Staging Batch")
        make_staging_school(
            db_session,
            batch_id=batch.id,
            name="Detail School",
            metadata_json={"products": {"info": {"status": "verified"}}},
        )

        detail = BatchService.get_batch_detail(db_session, str(batch.id))
        assert detail.batch.name == "Detail Staging Batch"
        assert len(detail.schools) == 1
        assert detail.schools[0].name == "Detail School"
        assert detail.schools[0].products["info"]["status"] == "verified"

    def test_get_batch_detail_legacy(self, db_session: Session):
        batch = make_batch(db_session, name="Detail Legacy Batch")
        school = make_school(db_session, name="Legacy Detail School")
        bs = BatchSchoolModel(
            batch_id=batch.id,
            school_id=school.id,
            status="ready",
            metadata_json={"products": {"info": {"status": "needs_review"}}},
        )
        db_session.add(bs)
        db_session.commit()

        detail = BatchService.get_batch_detail(db_session, str(batch.id))
        assert detail.batch.name == "Detail Legacy Batch"
        assert len(detail.schools) == 1
        assert detail.schools[0].name == "Legacy Detail School"
        assert detail.schools[0].products["info"]["status"] == "needs_review"

    def test_get_batch_detail_not_found_raises(self, db_session: Session):
        with pytest.raises(ValueError, match="not found"):
            BatchService.get_batch_detail(db_session, str(uuid4()))
