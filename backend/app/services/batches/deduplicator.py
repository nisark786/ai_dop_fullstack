"""Duplicate detection and intake row validation for Batch Intake.

Performs domain matching and fuzzy name matching against existing schools.
"""

import logging
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.schools import Schools
from app.schemas.batch import DuplicateMatchInfo, IntakeRowPreview

logger = logging.getLogger(__name__)


def normalize_domain(url: str | None) -> str | None:
    """Extract lowercase netloc without 'www.' prefix."""
    if not url:
        return None
    url_str = str(url).strip()
    if not url_str.startswith(("http://", "https://")):
        url_str = "https://" + url_str
    try:
        parsed = urlparse(url_str)
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc or None
    except (ValueError, AttributeError) as err:
        logger.debug("URL parsing failed for '%s': %s", url_str, err)
        return None


def find_exact_domain_match(db: Session, website: str | None) -> DuplicateMatchInfo | None:
    """Finds existing school with identical normalized website domain."""
    domain = normalize_domain(website)
    if not domain:
        return None

    query = (
        db.query(Schools)
        .filter(Schools.website.is_not(None))
        .filter(Schools.website.ilike(f"%{domain}%"))
        .first()
    )
    if query:
        return DuplicateMatchInfo(
            existing_school_id=str(query.id),
            existing_school_name=query.name,
            existing_website=query.website,
            match_type="exact_domain",
            confidence_score=1.0,
        )
    return None


def find_fuzzy_name_match(
    db: Session, name: str, threshold: float = 0.7
) -> DuplicateMatchInfo | None:
    """Finds existing school by similarity or case-insensitive matching."""
    if not name or len(name.strip()) < 3:
        return None

    # Check for exact case-insensitive match first
    exact = db.query(Schools).filter(Schools.name.ilike(name.strip())).first()
    if exact:
        return DuplicateMatchInfo(
            existing_school_id=str(exact.id),
            existing_school_name=exact.name,
            existing_website=exact.website,
            match_type="fuzzy_name",
            confidence_score=0.95,
        )

    # Cross-dialect similarity search
    bind = db.get_bind()
    dialect_name = bind.dialect.name if bind else "postgresql"
    if dialect_name == "postgresql":
        try:
            sql = text(
                """
                SELECT id, name, website, similarity(name, :input_name) as score
                FROM schools
                WHERE similarity(name, :input_name) >= :threshold
                ORDER BY score DESC
                LIMIT 1
                """
            )
            result = db.execute(sql, {"input_name": name, "threshold": threshold}).first()
            if result:
                return DuplicateMatchInfo(
                    existing_school_id=str(result[0]),
                    existing_school_name=result[1],
                    existing_website=result[2],
                    match_type="fuzzy_name",
                    confidence_score=float(result[3]),
                )
        except SQLAlchemyError as exc:
            logger.warning("Fuzzy name match failed on PostgreSQL trigram query: %s", exc)
            db.rollback()

    return None


def build_intake_preview_row(
    row_num: int, raw: dict[str, Any], db: Session
) -> tuple[IntakeRowPreview, bool, bool]:
    """Validates raw row and checks for duplicates."""
    name = (
        raw.get("name")
        or raw.get("school_name")
        or raw.get("school name")
        or raw.get("school")
        or ""
    ).strip()
    website = (
        raw.get("website")
        or raw.get("url")
        or raw.get("school_url")
        or raw.get("school website")
        or ""
    ).strip() or None
    address = (
        raw.get("address")
        or raw.get("street")
        or raw.get("full_address")
        or raw.get("school address")
        or ""
    ).strip() or None
    district = (
        raw.get("district")
        or raw.get("district_name")
        or raw.get("isd")
        or raw.get("school district")
        or ""
    ).strip() or None
    state = (raw.get("state") or raw.get("st") or "").strip() or None
    phone = (
        raw.get("phone")
        or raw.get("telephone")
        or raw.get("phone_number")
        or raw.get("phone number")
        or ""
    ).strip() or None
    email = (
        raw.get("email")
        or raw.get("email_address")
        or raw.get("school_email")
        or raw.get("school email")
        or ""
    ).strip() or None
    raw_type = raw.get("type") or raw.get("school_type") or raw.get("school type") or None
    raw_grades = (
        raw.get("grades")
        or raw.get("grade")
        or raw.get("grades_offered")
        or raw.get("grades offered")
        or None
    )

    errors: list[str] = []
    if not name:
        errors.append("School name is required")
    elif len(name) < 2:
        errors.append("School name must be at least 2 characters")

    # Name + (Address or Website) required
    if not website and not address:
        errors.append("At least Website or Address must be provided")

    if website:
        domain = normalize_domain(website)
        if not domain or "." not in domain:
            errors.append(f"Invalid website URL: '{website}'")

    duplicate = None
    if name:
        duplicate = find_exact_domain_match(db, website)
        if not duplicate:
            duplicate = find_fuzzy_name_match(db, name)

    is_valid = len(errors) == 0
    selected_action = "link" if (duplicate and duplicate.confidence_score >= 0.85) else "create"

    preview_row = IntakeRowPreview(
        row_number=row_num,
        name=name or f"Row {row_num}",
        website=website,
        address=address,
        district=district,
        state=state,
        phone=phone,
        email=email,
        type=raw_type,
        grades=raw_grades,
        is_valid=is_valid,
        validation_errors=errors,
        potential_duplicate=duplicate,
        selected_action=selected_action,
    )
    return preview_row, is_valid, duplicate is not None
