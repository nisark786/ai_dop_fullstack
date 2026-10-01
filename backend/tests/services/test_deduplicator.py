"""
Unit tests for Deduplication & Intake Row Validation Service.

Service:
    app.services.batches.deduplicator
"""

import uuid

from sqlalchemy.orm import Session

from app.services.batches.deduplicator import (
    build_intake_preview_row,
    find_exact_domain_match,
    find_fuzzy_name_match,
    normalize_domain,
)
from tests.factories import make_school


class TestNormalizeDomain:
    """Tests for normalize_domain function."""

    def test_normalize_domain_strips_protocol_and_www(self) -> None:
        """Strips https:// and leading www. prefix."""
        assert normalize_domain("https://www.myschool.org/about") == "myschool.org"
        assert normalize_domain("http://www.myschool.org") == "myschool.org"

    def test_normalize_domain_adds_scheme_if_missing(self) -> None:
        """Handles bare domain strings without protocol prefix."""
        assert normalize_domain("www.academy.edu") == "academy.edu"
        assert normalize_domain("charter.org/path") == "charter.org"

    def test_normalize_domain_none_and_empty(self) -> None:
        """Returns None for falsy or empty input."""
        assert normalize_domain(None) is None
        assert normalize_domain("") is None
        assert normalize_domain("   ") is None


class TestDomainMatching:
    """Tests for find_exact_domain_match."""

    def test_find_exact_domain_match_success(self, db_session: Session) -> None:
        """Finds existing school with matching website domain and returns confidence 1.0."""
        unique_domain = f"school-{uuid.uuid4().hex[:6]}.edu"
        school = make_school(
            db_session,
            name="Existing Magnet School",
            website=f"https://www.{unique_domain}/home",
        )
        db_session.flush()

        match = find_exact_domain_match(db_session, f"https://{unique_domain}")
        assert match is not None
        assert match.existing_school_id == str(school.id)
        assert match.existing_school_name == "Existing Magnet School"
        assert match.match_type == "exact_domain"
        assert match.confidence_score == 1.0

    def test_find_exact_domain_match_no_match(self, db_session: Session) -> None:
        """Returns None when no school shares the website domain."""
        assert find_exact_domain_match(db_session, "https://nonexistent-domain.edu") is None
        assert find_exact_domain_match(db_session, None) is None


class TestFuzzyNameMatching:
    """Tests for find_fuzzy_name_match."""

    def test_find_fuzzy_name_match_short_name_returns_none(self, db_session: Session) -> None:
        """Names shorter than 3 characters immediately return None."""
        assert find_fuzzy_name_match(db_session, "AB") is None
        assert find_fuzzy_name_match(db_session, " ") is None

    def test_find_fuzzy_name_match_exact_case_insensitive(self, db_session: Session) -> None:
        """Matches school case-insensitively with 0.95 confidence score."""
        unique_name = f"Summit Classical Academy {uuid.uuid4().hex[:4]}"
        school = make_school(db_session, name=unique_name)
        db_session.flush()

        match = find_fuzzy_name_match(db_session, unique_name.lower())
        assert match is not None
        assert match.existing_school_id == str(school.id)
        assert match.match_type == "fuzzy_name"
        assert match.confidence_score == 0.95

    def test_find_fuzzy_name_match_no_match_returns_none(self, db_session: Session) -> None:
        """Unmatched name returns None."""
        assert find_fuzzy_name_match(db_session, "Completely Unknown School Name XYZ") is None


class TestBuildIntakePreviewRow:
    """Tests for build_intake_preview_row validation and duplicate selection."""

    def test_valid_row_defaults_to_create_action(self, db_session: Session) -> None:
        """Valid brand-new school without duplicate matches selects 'create'."""
        raw = {
            "name": f"New Hope Elementary {uuid.uuid4().hex[:4]}",
            "address": "400 Hope Way",
            "state": "TX",
        }
        preview, is_valid, has_dup = build_intake_preview_row(1, raw, db_session)

        assert is_valid is True
        assert has_dup is False
        assert preview.is_valid is True
        assert preview.validation_errors == []
        assert preview.selected_action == "create"
        assert preview.potential_duplicate is None

    def test_missing_name_fails_validation(self, db_session: Session) -> None:
        """Missing or blank school name results in is_valid=False."""
        raw = {"name": "", "address": "123 Main"}
        preview, is_valid, _ = build_intake_preview_row(2, raw, db_session)

        assert is_valid is False
        assert any("name is required" in err.lower() for err in preview.validation_errors)

    def test_short_name_fails_validation(self, db_session: Session) -> None:
        """Name shorter than 2 characters results in validation error."""
        raw = {"name": "X", "address": "123 Main"}
        preview, is_valid, _ = build_intake_preview_row(3, raw, db_session)

        assert is_valid is False
        assert any("at least 2 characters" in err.lower() for err in preview.validation_errors)

    def test_missing_both_website_and_address_fails_validation(self, db_session: Session) -> None:
        """Name provided without either website or address fails contact validation."""
        raw = {"name": "Valid School Name", "district": "Some ISD"}
        preview, is_valid, _ = build_intake_preview_row(4, raw, db_session)

        assert is_valid is False
        assert any(
            "at least website or address" in err.lower() for err in preview.validation_errors
        )

    def test_invalid_website_domain_fails_validation(self, db_session: Session) -> None:
        """Website URL without domain extension fails validation."""
        raw = {"name": "Valid School Name", "website": "invalid-url-no-dot"}
        preview, is_valid, _ = build_intake_preview_row(5, raw, db_session)

        assert is_valid is False
        assert any("invalid website url" in err.lower() for err in preview.validation_errors)

    def test_duplicate_school_selects_link_action(self, db_session: Session) -> None:
        """When an exact domain match is found with confidence >= 0.85, action becomes 'link'."""
        dup_domain = f"dup-{uuid.uuid4().hex[:6]}.org"
        school = make_school(
            db_session,
            name="Existing St. Jude School",
            website=f"https://{dup_domain}",
        )
        db_session.flush()

        raw = {
            "name": "St. Jude School",
            "website": f"https://www.{dup_domain}",
            "address": "100 Church St",
        }
        preview, is_valid, has_dup = build_intake_preview_row(6, raw, db_session)

        assert is_valid is True
        assert has_dup is True
        assert preview.selected_action == "link"
        assert preview.potential_duplicate is not None
        assert preview.potential_duplicate.existing_school_id == str(school.id)

    def test_build_intake_preview_row_extracts_grades_and_contacts(
        self, db_session: Session
    ) -> None:
        """Raw row containing grades, phone, email, and type preserves all attributes."""
        raw = {
            "name": "St. Mark Academy",
            "address": "400 Maple Ave, Dallas, TX",
            "phone": "(214) 555-0199",
            "email": "info@stmark.edu",
            "type": ["private"],
            "grades": '["Kindergarten", "1st grade", "2nd grade"]',
        }
        preview, is_valid, has_dup = build_intake_preview_row(7, raw, db_session)

        assert is_valid is True
        assert preview.phone == "(214) 555-0199"
        assert preview.email == "info@stmark.edu"
        assert preview.type == ["private"]
        assert preview.grades == ["Kindergarten", "1st grade", "2nd grade"]
