"""Batch Service orchestrating operational grouping, previewing, and lifecycle management."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.batch import BatchModel, BatchSchoolModel
from app.models.metadata_output import MetadataAgentOutputModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.schemas.batch import (
    AddBatchSchoolRequest,
    BatchConfirmCreateRequest,
    BatchDetailResponse,
    BatchDetailSchoolItem,
    BatchSummaryItem,
    BatchUpdateRequest,
    BatchUploadPreviewResponse,
    ProductProgressItem,
)
from app.services.batches.deduplicator import build_intake_preview_row
from app.services.batches.file_parser import MAX_FILE_BYTES, MAX_INTAKE_ROWS, BatchFileParser


class BatchService:
    """Orchestrates batch creation, upload previews, and detail fetching."""

    @staticmethod
    def generate_upload_preview(
        contents: bytes, filename: str, db: Session
    ) -> BatchUploadPreviewResponse:
        if len(contents) > MAX_FILE_BYTES:
            raise ValueError("File exceeds the 10 MB maximum size limit.")

        is_csv = filename.lower().endswith(".csv")
        try:
            raw_rows = (
                BatchFileParser.parse_csv(contents)
                if is_csv
                else BatchFileParser.parse_excel(contents)
            )
        except Exception as e:
            raise ValueError(f"Failed to parse file: {e}") from e

        if len(raw_rows) > MAX_INTAKE_ROWS:
            raise ValueError(
                f"File contains {len(raw_rows)} rows; maximum allowed is {MAX_INTAKE_ROWS}."
            )

        preview_rows = []
        valid_count = 0
        invalid_count = 0
        duplicates_count = 0

        for i, row in enumerate(raw_rows, start=1):
            preview_row, is_valid, has_duplicate = build_intake_preview_row(i, row, db)
            preview_rows.append(preview_row)
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1
            if has_duplicate:
                duplicates_count += 1

        return BatchUploadPreviewResponse(
            filename=filename,
            total_rows=len(raw_rows),
            valid_rows_count=valid_count,
            invalid_rows_count=invalid_count,
            duplicates_count=duplicates_count,
            rows=preview_rows,
        )

    @staticmethod
    def confirm_and_create_batch(
        db: Session,
        payload: BatchConfirmCreateRequest,
        created_by: str = "operator",
    ) -> BatchDetailResponse:
        batch_id = uuid.uuid4()

        valid_rows = [r for r in payload.rows if str(r.name or "").strip()]

        batch = BatchModel(
            id=batch_id,
            name=payload.name,
            description=payload.description,
            source_type=payload.source_type,
            status="ready",
            school_count=len(valid_rows),
            created_by=created_by,
        )
        db.add(batch)

        # Create isolated staging records instead of inserting directly into golden schools table
        for row in valid_rows:
            prod_id = row.link_school_id if (row.action == "link" and row.link_school_id) else None
            staging_school = StagingSchoolModel(
                id=uuid.uuid4(),
                batch_id=batch_id,
                production_school_id=prod_id,
                name=row.name,
                website=row.website,
                address=row.address,
                district=row.district,
                state=row.state,
                phone=row.phone,
                email=row.email,
                type=row.type or [],
                grades=row.grades or [],
                status="pending",
                source_data={
                    "original_name": row.name,
                    "original_website": row.website,
                    "original_address": row.address,
                    "original_district": row.district,
                    "original_state": row.state,
                    "original_phone": row.phone,
                    "original_email": row.email,
                    "original_type": row.type,
                    "original_grades": row.grades,
                },
                metadata_json={
                    "products": {
                        "info": {"status": "not_run"},
                    }
                },
            )
            db.add(staging_school)

        db.commit()
        return BatchService.get_batch_detail(db, batch_id)

    @staticmethod
    def list_batches(
        db: Session,
        status: str | None,
        search: str | None,
        limit: int,
        offset: int,
        include_trash: bool = False,
    ) -> list[BatchSummaryItem]:
        query = db.query(BatchModel)
        if not include_trash:
            query = query.filter(BatchModel.deleted_at.is_(None))
        if status and status.lower() not in {"", "all"}:
            query = query.filter(BatchModel.status == status)
        if search:
            query = query.filter(BatchModel.name.ilike(f"%{search}%"))

        batches = query.order_by(BatchModel.created_at.desc()).offset(offset).limit(limit).all()
        now = datetime.now(UTC)

        # Dynamically aggregate active staging schools per batch to ensure 100% consistency
        staging_counts = dict(
            db.query(StagingSchoolModel.batch_id, func.count(StagingSchoolModel.id))
            .filter(StagingSchoolModel.deleted_at.is_(None))
            .group_by(StagingSchoolModel.batch_id)
            .all()
        )

        items = []
        needs_commit = False
        for b in batches:
            active_staging = staging_counts.get(b.id)
            if active_staging is not None:
                eff_count = active_staging
                if b.school_count != active_staging:
                    b.school_count = active_staging
                    needs_commit = True
            else:
                eff_count = b.school_count

            del_at = b.deleted_at
            if del_at and del_at.tzinfo is None:
                del_at = del_at.replace(tzinfo=UTC)
            days_rem = max(0, 30 - (now - del_at).days) if del_at else None

            items.append(
                BatchSummaryItem(
                    id=b.id,
                    name=b.name,
                    description=b.description,
                    source_type=b.source_type,
                    status=b.status,
                    school_count=eff_count,
                    created_by=b.created_by,
                    created_at=b.created_at,
                    updated_at=b.updated_at,
                    deleted_at=b.deleted_at,
                    days_remaining=days_rem,
                )
            )

        if needs_commit:
            db.commit()

        return items

    @staticmethod
    def list_trash_batches(
        db: Session, search: str | None = None, limit: int = 50, offset: int = 0
    ) -> list[BatchSummaryItem]:
        query = db.query(BatchModel).filter(BatchModel.deleted_at.is_not(None))
        if search:
            query = query.filter(BatchModel.name.ilike(f"%{search}%"))

        batches = query.order_by(BatchModel.deleted_at.desc()).offset(offset).limit(limit).all()
        now = datetime.now(UTC)

        staging_counts = dict(
            db.query(StagingSchoolModel.batch_id, func.count(StagingSchoolModel.id))
            .filter(StagingSchoolModel.deleted_at.is_(None))
            .group_by(StagingSchoolModel.batch_id)
            .all()
        )

        items = []
        needs_commit = False
        for b in batches:
            active_staging = staging_counts.get(b.id)
            if active_staging is not None:
                eff_count = active_staging
                if b.school_count != active_staging:
                    b.school_count = active_staging
                    needs_commit = True
            else:
                eff_count = b.school_count

            del_at = b.deleted_at
            if del_at and del_at.tzinfo is None:
                del_at = del_at.replace(tzinfo=UTC)
            days_rem = max(0, 30 - (now - del_at).days) if del_at else None

            items.append(
                BatchSummaryItem(
                    id=b.id,
                    name=b.name,
                    description=b.description,
                    source_type=b.source_type,
                    status=b.status,
                    school_count=eff_count,
                    created_by=b.created_by,
                    created_at=b.created_at,
                    updated_at=b.updated_at,
                    deleted_at=b.deleted_at,
                    days_remaining=days_rem,
                )
            )

        if needs_commit:
            db.commit()

        return items

    @staticmethod
    def update_batch(db: Session, batch_id: str, payload: BatchUpdateRequest) -> BatchSummaryItem:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        batch.name = payload.name.strip()
        batch.description = payload.description.strip() if payload.description else None
        batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(batch)

        now = datetime.utcnow()
        return BatchSummaryItem(
            id=batch.id,
            name=batch.name,
            description=batch.description,
            source_type=batch.source_type,
            status=batch.status,
            school_count=batch.school_count,
            created_by=batch.created_by,
            created_at=batch.created_at,
            updated_at=batch.updated_at,
            deleted_at=batch.deleted_at,
            days_remaining=max(0, 30 - (now - batch.deleted_at).days) if batch.deleted_at else None,
        )

    @staticmethod
    def soft_delete_batch(db: Session, batch_id: str) -> BatchSummaryItem:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        active_staging_jobs = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.deleted_at.is_(None),
                StagingSchoolModel.status.in_(["crawling", "running", "extracting"]),
            )
            .count()
        )
        if active_staging_jobs > 0 or batch.status in ("processing", "running"):
            raise ValueError(
                "Cannot delete batch while crawling jobs are actively running. Pause or cancel jobs first."
            )

        now = datetime.now(UTC)
        batch.deleted_at = now
        batch.status = "trashed"
        batch.updated_at = now
        db.commit()
        db.refresh(batch)

        del_at = batch.deleted_at
        if del_at and del_at.tzinfo is None:
            del_at = del_at.replace(tzinfo=UTC)

        return BatchSummaryItem(
            id=batch.id,
            name=batch.name,
            description=batch.description,
            source_type=batch.source_type,
            status=batch.status,
            school_count=batch.school_count,
            created_by=batch.created_by,
            created_at=batch.created_at,
            updated_at=batch.updated_at,
            deleted_at=batch.deleted_at,
            days_remaining=max(0, 30 - (now - del_at).days) if del_at else None,
        )

    @staticmethod
    def restore_batch(db: Session, batch_id: str) -> BatchSummaryItem:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        now = datetime.now(UTC)
        batch.deleted_at = None
        batch.status = "ready"
        batch.updated_at = now
        db.commit()
        db.refresh(batch)

        return BatchSummaryItem(
            id=batch.id,
            name=batch.name,
            description=batch.description,
            source_type=batch.source_type,
            status=batch.status,
            school_count=batch.school_count,
            created_by=batch.created_by,
            created_at=batch.created_at,
            updated_at=batch.updated_at,
            deleted_at=None,
            days_remaining=None,
        )

    @staticmethod
    def permanent_delete_batch(db: Session, batch_id: str) -> dict[str, str]:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        active_staging_jobs = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.deleted_at.is_(None),
                StagingSchoolModel.status.in_(["crawling", "running", "extracting"]),
            )
            .count()
        )
        if active_staging_jobs > 0 or batch.status in ("processing", "running"):
            raise ValueError(
                "Cannot delete batch while crawling jobs are actively running. Pause or cancel jobs first."
            )

        db.delete(batch)
        db.commit()
        return {"message": f"Batch {batch_id} permanently deleted"}

    @staticmethod
    def add_school_to_batch(
        db: Session, batch_id: str, payload: AddBatchSchoolRequest
    ) -> BatchDetailSchoolItem:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")
        if batch.deleted_at is not None:
            raise ValueError("Cannot add school to a trashed batch. Please restore it first.")

        # 1. Resolve school entity
        # 1. Determine production link if existing
        prod_id = None
        if payload.school_id:
            existing_prod = db.query(Schools).filter(Schools.id == payload.school_id).first()
            if existing_prod:
                prod_id = existing_prod.id
                payload.name = payload.name or existing_prod.name
                payload.website = payload.website or existing_prod.website
                payload.address = payload.address or existing_prod.address

        name = (payload.name or "").strip()
        if len(name) < 2:
            raise ValueError("School name must be at least 2 characters long")
        if not payload.website and not payload.address:
            raise ValueError("At least Website or Address must be provided")

        # 2. Check if already in staging_schools
        existing_staging = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.name.ilike(name),
            )
            .first()
        )
        if existing_staging:
            raise ValueError(f"School '{name}' is already a member of this batch")

        # 3. Create isolated staging record
        staging = StagingSchoolModel(
            id=uuid.uuid4(),
            batch_id=batch_id,
            production_school_id=prod_id,
            name=name,
            website=payload.website.strip() if payload.website else None,
            address=payload.address.strip() if payload.address else None,
            district=payload.district.strip() if payload.district else None,
            state=payload.state.strip() if payload.state else None,
            status="pending",
            source_data={"original_name": name},
            metadata_json={
                "products": {
                    "info": {"status": "not_run"},
                }
            },
        )
        db.add(staging)
        db.flush()

        # 4. Update batch school count
        current_count = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .count()
        )
        batch.school_count = current_count
        batch.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(staging)

        return BatchDetailSchoolItem(
            school_id=staging.id,
            name=staging.name,
            website=staging.website,
            address=staging.address,
            district=payload.district,
            state=payload.state,
            status=staging.status,
            added_at=staging.created_at,
        )

    @staticmethod
    def drop_school_from_batch(db: Session, batch_id: str, school_id: Any) -> dict[str, Any]:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        # Check staging_schools first
        staging = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.id == school_id,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .first()
        )
        if staging:
            now = datetime.now(UTC)
            staging.deleted_at = now
            staging.updated_at = now
            db.flush()

            # Orphan Guard: cancel pending/unreviewed metadata agent outputs
            db.query(MetadataAgentOutputModel).filter(
                MetadataAgentOutputModel.staging_school_id == staging.id,
                MetadataAgentOutputModel.verification_status.in_(
                    ["needs_review", "pending", "invalid"]
                ),
            ).update(
                {"verification_status": "cancelled"},
                synchronize_session=False,
            )

            current_count = (
                db.query(StagingSchoolModel)
                .filter(
                    StagingSchoolModel.batch_id == batch_id,
                    StagingSchoolModel.deleted_at.is_(None),
                )
                .count()
            )
            batch.school_count = current_count
            batch.updated_at = now
            db.commit()
            return {
                "message": f"School '{staging.name}' moved to trash",
                "batch_id": batch_id,
                "school_id": str(school_id),
                "remaining_schools": batch.school_count,
            }

        membership = (
            db.query(BatchSchoolModel)
            .filter(
                BatchSchoolModel.batch_id == batch_id,
                BatchSchoolModel.school_id == school_id,
            )
            .first()
        )
        if not membership:
            raise ValueError(f"School is not associated with batch {batch_id}")

        db.delete(membership)

        current_count = (
            db.query(BatchSchoolModel).filter(BatchSchoolModel.batch_id == batch_id).count()
        )
        batch.school_count = max(0, current_count - 1)
        batch.updated_at = datetime.now(UTC)
        db.commit()

        return {
            "message": "School successfully dropped from batch",
            "batch_id": batch_id,
            "school_id": str(school_id),
            "remaining_schools": batch.school_count,
        }

    @staticmethod
    def bulk_drop_schools(db: Session, batch_id: str, school_ids: list[str]) -> dict[str, Any]:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        now = datetime.now(UTC)
        dropped_count = 0

        # 1. Soft-delete staging schools
        staging_schools = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.id.in_(school_ids),
                StagingSchoolModel.deleted_at.is_(None),
            )
            .all()
        )

        dropped_staging_ids = []
        for st in staging_schools:
            st.deleted_at = now
            st.updated_at = now
            dropped_staging_ids.append(st.id)
            dropped_count += 1

        if dropped_staging_ids:
            # Orphan Guard: cancel pending/unreviewed metadata agent outputs
            db.query(MetadataAgentOutputModel).filter(
                MetadataAgentOutputModel.staging_school_id.in_(dropped_staging_ids),
                MetadataAgentOutputModel.verification_status.in_(
                    ["needs_review", "pending", "invalid"]
                ),
            ).update(
                {"verification_status": "cancelled"},
                synchronize_session=False,
            )

        # 2. Also handle legacy batch_schools membership if any
        legacy_memberships = (
            db.query(BatchSchoolModel)
            .filter(
                BatchSchoolModel.batch_id == batch_id,
                BatchSchoolModel.school_id.in_(school_ids),
            )
            .all()
        )
        for lm in legacy_memberships:
            db.delete(lm)
            dropped_count += 1

        db.flush()

        # Recalculate remaining school count
        rem_staging = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .count()
        )
        batch.school_count = rem_staging
        batch.updated_at = now
        db.commit()

        return {
            "message": f"Successfully dropped {dropped_count} school(s) from batch",
            "batch_id": batch_id,
            "dropped_count": dropped_count,
            "remaining_schools": batch.school_count,
        }

    @staticmethod
    def purge_expired_trash(db: Session, retention_days: int = 30) -> int:
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        expired_batches = (
            db.query(BatchModel)
            .filter(
                BatchModel.deleted_at.is_not(None),
                BatchModel.deleted_at < cutoff,
            )
            .all()
        )
        purged_count = len(expired_batches)
        for b in expired_batches:
            db.delete(b)
        db.commit()
        return purged_count

    @staticmethod
    def get_batch_detail(db: Session, batch_id: str) -> BatchDetailResponse:
        batch = db.query(BatchModel).filter(BatchModel.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")

        staging_records = (
            db.query(StagingSchoolModel)
            .filter(
                StagingSchoolModel.batch_id == batch_id,
                StagingSchoolModel.deleted_at.is_(None),
            )
            .order_by(StagingSchoolModel.created_at.asc())
            .all()
        )

        school_items = []
        if staging_records:
            for s in staging_records:
                meta = s.metadata_json or {}
                products_map = meta.get("products") or {}
                if "info" not in products_map:
                    products_map["info"] = {"status": "not_run"}

                school_items.append(
                    BatchDetailSchoolItem(
                        school_id=s.id,
                        name=s.name,
                        website=s.website,
                        address=s.address,
                        district=s.district,
                        state=s.state,
                        status=s.status,
                        added_at=s.created_at,
                        products=products_map,
                    )
                )
        else:
            # Fallback for legacy batches created prior to staging
            batch_schools = (
                db.query(BatchSchoolModel, Schools)
                .join(Schools, BatchSchoolModel.school_id == Schools.id)
                .filter(BatchSchoolModel.batch_id == batch_id)
                .all()
            )
            for bs, school in batch_schools:
                meta = bs.metadata_json or {}
                products_map = meta.get("products") or {}
                school_items.append(
                    BatchDetailSchoolItem(
                        school_id=school.id,
                        name=school.name,
                        website=school.website,
                        address=school.address,
                        district=meta.get("original_district"),
                        state=meta.get("original_state"),
                        status=bs.status,
                        added_at=bs.added_at,
                        products=products_map,
                    )
                )

        matrix: list[ProductProgressItem] = []

        return BatchDetailResponse(
            batch=BatchSummaryItem(
                id=batch.id,
                name=batch.name,
                description=batch.description,
                source_type=batch.source_type,
                status=batch.status,
                school_count=len(school_items),
                created_by=batch.created_by,
                created_at=batch.created_at,
                updated_at=batch.updated_at,
                deleted_at=batch.deleted_at,
                days_remaining=max(0, 30 - (datetime.utcnow() - batch.deleted_at).days)
                if batch.deleted_at
                else None,
            ),
            schools=school_items,
            product_matrix=matrix,
        )
