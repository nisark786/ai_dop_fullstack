import math
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_database_session
from app.models.batch import BatchModel
from app.models.schools import Schools
from app.models.staging_school import StagingSchoolModel
from app.schemas.school import (
    PaginatedSchoolsResponse,
    SchoolActionResponse,
    SchoolResponseSchema,
    SchoolStatsSchema,
    SchoolTrashItem,
)

router = APIRouter(prefix="/schools", tags=["Schools"])


@router.get(
    "/stats", response_model=SchoolStatsSchema, summary="Get school database summary metrics"
)
def get_school_stats(db: Session = Depends(get_database_session)):
    """
    Returns aggregated metrics: total schools, active count, inactive count, and verification status.
    Excludes soft-deleted schools.
    """
    active_filter = Schools.deleted_at.is_(None)
    total = db.query(func.count(Schools.id)).filter(active_filter).scalar() or 0
    active = (
        db.query(func.count(Schools.id)).filter(active_filter, Schools.is_active.is_(True)).scalar()
        or 0
    )
    inactive = (
        db.query(func.count(Schools.id))
        .filter(active_filter, Schools.is_active.is_(False))
        .scalar()
        or 0
    )
    verified = (
        db.query(func.count(Schools.id))
        .filter(active_filter, Schools.profile_verification_status == "verified")
        .scalar()
        or 0
    )
    pending = (
        db.query(func.count(Schools.id))
        .filter(
            active_filter,
            or_(
                Schools.profile_verification_status == "pending",
                Schools.profile_verification_status.is_(None),
            ),
        )
        .scalar()
        or 0
    )

    return SchoolStatsSchema(
        total_schools=total,
        active_schools=active,
        inactive_schools=inactive,
        verified_schools=verified,
        pending_schools=pending,
    )


@router.get(
    "",
    response_model=PaginatedSchoolsResponse,
    summary="List schools with pagination, sorting & filtering",
)
def list_schools(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=500, description="Items per page"),
    status: str | None = Query("all", description="Filter by active state: all, active, inactive"),
    verification_status: str | None = Query(
        None, description="Filter: verified, pending, needs_review, unverified"
    ),
    school_type: str | None = Query(
        None, description="Filter by type: Public, Charter, Private, Magnet"
    ),
    missing_website: bool | None = Query(
        None, description="Filter schools with missing/empty website"
    ),
    search: str | None = Query(None, description="Search by name, address, city, or zip code"),
    sort_by: str = Query(
        "updated_at",
        description="Sort field: name, city, is_active, profile_verification_status, updated_at",
    ),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    db: Session = Depends(get_database_session),
):
    """
    Retrieve schools from Supabase with enterprise pagination, multi-column sorting,
    and multi-facet filtering.
    """
    query = db.query(Schools).filter(Schools.deleted_at.is_(None))

    # 1. Filter by Active / Inactive
    if status == "active":
        query = query.filter(Schools.is_active.is_(True))
    elif status == "inactive":
        query = query.filter(Schools.is_active.is_(False))

    # 2. Filter by Verification Status
    if verification_status and verification_status != "all":
        if verification_status == "pending":
            query = query.filter(
                or_(
                    Schools.profile_verification_status == "pending",
                    Schools.profile_verification_status.is_(None),
                )
            )
        else:
            query = query.filter(Schools.profile_verification_status == verification_status)

    # 3. Filter by Missing Website
    if missing_website is True:
        query = query.filter(
            or_(Schools.website.is_(None), Schools.website == "", Schools.website == "null")
        )
    elif missing_website is False:
        query = query.filter(
            and_(Schools.website.isnot(None), Schools.website != "", Schools.website != "null")
        )

    # 4. Filter by School Type (JSONB search)
    if school_type and school_type != "all":
        # Check if type contains the text or type jsonb contains string
        query = query.filter(Schools.type.cast(func.text()).ilike(f"%{school_type}%"))

    # 5. Search
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Schools.name.ilike(pattern),
                Schools.address.ilike(pattern),
                Schools.city.ilike(pattern),
                Schools.zip_code.ilike(pattern),
                Schools.full_address.ilike(pattern),
            )
        )

    # Count matching records for pagination
    total = query.with_entities(func.count(Schools.id)).scalar() or 0
    total_pages = max(1, math.ceil(total / page_size))

    # 6. Sorting
    sort_column_map = {
        "name": Schools.name,
        "city": Schools.city,
        "is_active": Schools.is_active,
        "profile_verification_status": Schools.profile_verification_status,
        "created_at": Schools.created_at,
        "updated_at": Schools.updated_at,
    }
    sort_column = sort_column_map.get(sort_by, Schools.updated_at)

    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc().nullslast())
    else:
        query = query.order_by(sort_column.desc().nullslast())

    # 7. Pagination offset and limit
    offset = (page - 1) * page_size
    schools = query.offset(offset).limit(page_size).all()

    # Format UUIDs as strings for schema
    items = []
    for s in schools:
        res = SchoolResponseSchema(
            id=str(s.id),
            name=s.name or "Unknown School",
            website=s.website,
            url=s.url,
            address=s.address or s.full_address,
            city=s.city,
            state=s.state,
            zip_code=s.zip_code,
            phone=s.phone,
            email=s.email,
            description=s.description,
            type=s.type if isinstance(s.type, list) else [],
            grades=s.grades if isinstance(s.grades, list) else [],
            is_active=bool(s.is_active),
            profile_verification_status=s.profile_verification_status,
            profile_verified_at=s.profile_verified_at,
            rating=float(s.rating) if s.rating is not None else None,
            places_id=s.places_id,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        items.append(res)

    return PaginatedSchoolsResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


# --- Trash Bucket Endpoints (declared BEFORE /{school_id} to avoid route shadowing) ---


@router.get(
    "/trash",
    response_model=list[SchoolTrashItem],
    summary="List quarantined schools in the Trash Bucket",
)
def list_trash_schools(
    search: str | None = Query(
        None, description="Search trashed schools by name, city, or address"
    ),
    db: Session = Depends(get_database_session),
) -> list[SchoolTrashItem]:
    """Retrieve all soft-deleted schools quarantined in the Trash Bucket from staging_schools."""
    now = datetime.now(UTC)
    results: list[SchoolTrashItem] = []

    # 1. Query trashed staging schools (primary intake records)
    staging_query = db.query(StagingSchoolModel).filter(StagingSchoolModel.deleted_at.is_not(None))
    if search:
        search_filter = f"%{search.strip().lower()}%"
        staging_query = staging_query.filter(
            or_(
                func.lower(StagingSchoolModel.name).like(search_filter),
                func.lower(StagingSchoolModel.district).like(search_filter),
                func.lower(StagingSchoolModel.address).like(search_filter),
            )
        )

    trashed_staging = staging_query.order_by(StagingSchoolModel.deleted_at.desc()).all()
    for s in trashed_staging:
        del_at = s.deleted_at
        if del_at.tzinfo is None:
            del_at = del_at.replace(tzinfo=UTC)
        days_passed = (now - del_at).days
        days_remaining = max(0, 30 - days_passed)

        results.append(
            SchoolTrashItem(
                id=str(s.id),
                name=s.name,
                address=s.address,
                city=s.district or None,
                state=s.state,
                website=s.website,
                type=s.type if isinstance(s.type, list) else [],
                grades=s.grades if isinstance(s.grades, list) else [],
                deleted_at=s.deleted_at,
                days_remaining=days_remaining,
            )
        )

    # 2. Query trashed production schools if any
    prod_query = db.query(Schools).filter(Schools.deleted_at.is_not(None))
    if search:
        search_filter = f"%{search.strip().lower()}%"
        prod_query = prod_query.filter(
            or_(
                func.lower(Schools.name).like(search_filter),
                func.lower(Schools.city).like(search_filter),
                func.lower(Schools.address).like(search_filter),
            )
        )

    trashed_prod = prod_query.order_by(Schools.deleted_at.desc()).all()
    for s in trashed_prod:
        del_at = s.deleted_at
        if del_at.tzinfo is None:
            del_at = del_at.replace(tzinfo=UTC)
        days_passed = (now - del_at).days
        days_remaining = max(0, 30 - days_passed)

        results.append(
            SchoolTrashItem(
                id=str(s.id),
                name=s.name,
                address=s.address or s.full_address,
                city=s.city,
                state=s.state,
                website=s.website or s.url,
                type=s.type if isinstance(s.type, list) else [],
                grades=s.grades if isinstance(s.grades, list) else [],
                deleted_at=s.deleted_at,
                days_remaining=days_remaining,
            )
        )

    return results


@router.post(
    "/trash/purge-expired",
    summary="Purge expired schools from Trash Bucket (> 30 days)",
)
def purge_expired_trash_schools(
    retention_days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_database_session),
):
    """Permanently delete schools that have exceeded the retention threshold."""
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)

    expired_staging = (
        db.query(StagingSchoolModel)
        .filter(StagingSchoolModel.deleted_at.is_not(None), StagingSchoolModel.deleted_at < cutoff)
        .all()
    )
    count = len(expired_staging)
    for s in expired_staging:
        db.delete(s)

    expired_prod = (
        db.query(Schools).filter(Schools.deleted_at.is_not(None), Schools.deleted_at < cutoff).all()
    )
    count += len(expired_prod)
    for school in expired_prod:
        db.delete(school)

    db.commit()

    return {
        "purged_count": count,
        "message": f"Successfully purged {count} expired school(s) older than {retention_days} days.",
    }


@router.get(
    "/{school_id}", response_model=SchoolResponseSchema, summary="Get single school details"
)
def get_school_by_id(school_id: str, db: Session = Depends(get_database_session)):
    """
    Fetch full school record by UUID.
    """
    try:
        uuid_obj = UUID(school_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid UUID format for school ID.") from err

    school = db.query(Schools).filter(Schools.id == uuid_obj).first()
    if not school:
        raise HTTPException(status_code=404, detail=f"School '{school_id}' not found.")

    return SchoolResponseSchema(
        id=str(school.id),
        name=school.name,
        website=school.website,
        url=school.url,
        address=school.address or school.full_address,
        city=school.city,
        state=school.state,
        zip_code=school.zip_code,
        phone=school.phone,
        email=school.email,
        description=school.description,
        type=school.type if isinstance(school.type, list) else [],
        grades=school.grades if isinstance(school.grades, list) else [],
        is_active=bool(school.is_active),
        profile_verification_status=school.profile_verification_status,
        profile_verified_at=school.profile_verified_at,
        rating=float(school.rating) if school.rating is not None else None,
        places_id=school.places_id,
        created_at=school.created_at,
        updated_at=school.updated_at,
    )


@router.delete(
    "/{school_id}",
    response_model=SchoolActionResponse,
    summary="Soft-delete a school and move to Trash Bucket",
)
def delete_school(
    school_id: str,
    db: Session = Depends(get_database_session),
) -> SchoolActionResponse:
    """Soft-delete a school from staging or master directory into the Trash Bucket."""
    try:
        uuid_obj = UUID(school_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid UUID format for school ID.") from err

    now = datetime.now(UTC)

    # 1. Check staging schools
    staging = (
        db.query(StagingSchoolModel)
        .filter(StagingSchoolModel.id == uuid_obj, StagingSchoolModel.deleted_at.is_(None))
        .first()
    )
    if staging:
        staging.deleted_at = now
        staging.updated_at = now
        db.flush()
        batch = db.query(BatchModel).filter(BatchModel.id == staging.batch_id).first()
        if batch:
            batch.school_count = (
                db.query(StagingSchoolModel)
                .filter(
                    StagingSchoolModel.batch_id == batch.id,
                    StagingSchoolModel.deleted_at.is_(None),
                )
                .count()
            )
            batch.updated_at = now
        db.commit()
        return SchoolActionResponse(
            school_id=school_id,
            message=f"School '{staging.name}' was moved to Trash Bucket. Retained for 30 days.",
            status="trashed",
        )

    # 2. Check production schools
    school = db.query(Schools).filter(Schools.id == uuid_obj, Schools.deleted_at.is_(None)).first()
    if not school:
        raise HTTPException(status_code=404, detail=f"School '{school_id}' not found.")

    school_name = school.name
    school.deleted_at = now
    school.is_active = False
    school.updated_at = now
    db.commit()

    return SchoolActionResponse(
        school_id=school_id,
        message=f"School '{school_name}' was moved to Trash Bucket. Retained for 30 days.",
        status="trashed",
    )


@router.post(
    "/{school_id}/restore",
    response_model=SchoolActionResponse,
    summary="Restore a school from the Trash Bucket",
)
def restore_school(
    school_id: str,
    db: Session = Depends(get_database_session),
) -> SchoolActionResponse:
    """Restore a quarantined school back to active staging or production library."""
    try:
        uuid_obj = UUID(school_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid UUID format for school ID.") from err

    now = datetime.now(UTC)

    # 1. Check staging schools
    staging = (
        db.query(StagingSchoolModel)
        .filter(StagingSchoolModel.id == uuid_obj, StagingSchoolModel.deleted_at.is_not(None))
        .first()
    )
    if staging:
        staging.deleted_at = None
        staging.updated_at = now
        db.flush()
        batch = db.query(BatchModel).filter(BatchModel.id == staging.batch_id).first()
        if batch:
            batch.school_count = (
                db.query(StagingSchoolModel)
                .filter(
                    StagingSchoolModel.batch_id == batch.id,
                    StagingSchoolModel.deleted_at.is_(None),
                )
                .count()
            )
            batch.updated_at = now
        db.commit()
        return SchoolActionResponse(
            school_id=school_id,
            message=f"School '{staging.name}' was successfully restored to batch '{batch.name if batch else 'batch'}'.",
            status="restored",
        )

    # 2. Check production schools
    school = (
        db.query(Schools).filter(Schools.id == uuid_obj, Schools.deleted_at.is_not(None)).first()
    )
    if not school:
        raise HTTPException(status_code=404, detail=f"Trashed school '{school_id}' not found.")

    school_name = school.name
    school.deleted_at = None
    school.is_active = True
    school.updated_at = now
    db.commit()

    return SchoolActionResponse(
        school_id=school_id,
        message=f"School '{school_name}' was successfully restored to the master library.",
        status="restored",
    )


@router.delete(
    "/{school_id}/permanent",
    response_model=SchoolActionResponse,
    summary="Permanently delete a school from database",
)
def permanent_delete_school(
    school_id: str,
    db: Session = Depends(get_database_session),
) -> SchoolActionResponse:
    """Permanently delete a school and all associated records from the database."""
    try:
        uuid_obj = UUID(school_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid UUID format for school ID.") from err

    # 1. Check staging schools
    staging = db.query(StagingSchoolModel).filter(StagingSchoolModel.id == uuid_obj).first()
    if staging:
        school_name = staging.name
        b_id = staging.batch_id
        db.delete(staging)
        db.flush()
        batch = db.query(BatchModel).filter(BatchModel.id == b_id).first()
        if batch:
            batch.school_count = (
                db.query(StagingSchoolModel)
                .filter(
                    StagingSchoolModel.batch_id == batch.id,
                    StagingSchoolModel.deleted_at.is_(None),
                )
                .count()
            )
            batch.updated_at = datetime.now(UTC)
        db.commit()
        return SchoolActionResponse(
            school_id=school_id,
            message=f"School '{school_name}' was permanently purged from database.",
            status="purged",
        )

    # 2. Check production schools
    school = db.query(Schools).filter(Schools.id == uuid_obj).first()
    if not school:
        raise HTTPException(status_code=404, detail=f"School '{school_id}' not found.")

    school_name = school.name
    db.delete(school)
    db.commit()

    return SchoolActionResponse(
        school_id=school_id,
        message=f"School '{school_name}' was permanently purged from the database.",
        status="purged",
    )
