"""Unit tests for AWS RDS Sandbox normalizer and payload builder."""

from app.services.sandbox_sync.normalizer import (
    build_sandbox_payload,
    clean_phone_number,
    format_json_list,
    is_meaningful_value,
    sanitize_str,
)


def test_sanitize_str():
    assert sanitize_str(None) is None
    assert sanitize_str("") is None
    assert sanitize_str("   ") is None
    assert sanitize_str(" Austin High \0 School ") == "Austin High  School"
    assert sanitize_str(123) == "123"


def test_is_meaningful_value():
    assert not is_meaningful_value(None)
    assert not is_meaningful_value("")
    assert not is_meaningful_value("n/a")
    assert not is_meaningful_value("Unknown")
    assert not is_meaningful_value("None")
    assert not is_meaningful_value("undefined")
    assert not is_meaningful_value("[email protected]")
    assert not is_meaningful_value([])
    assert is_meaningful_value("Austin, TX")
    assert is_meaningful_value(["K", "1", "2"])


def test_clean_phone_number():
    assert clean_phone_number(None) is None
    assert clean_phone_number("") is None
    assert clean_phone_number("512-555-0100.0") == "512-555-0100"
    assert clean_phone_number("5125550100.0") == "5125550100"
    assert clean_phone_number("(512) 555-0100") == "(512) 555-0100"
    assert clean_phone_number("unknown") is None


def test_format_json_list():
    assert format_json_list(None) == []
    assert format_json_list([]) == []
    assert format_json_list(["K", "1", "2"]) == ["K", "1", "2"]
    assert format_json_list('["public", "charter"]') == ["public", "charter"]
    assert format_json_list("PK\nK\n1\n2") == ["PK", "K", "1", "2"]
    assert format_json_list(["None", "n/a", "private"]) == ["private"]


def test_build_sandbox_payload_extracts_only_active_fields():
    raw_data = {
        "name": "St. Stephen's Academy",
        "website": "https://ststephens.example.com",
        "address": "123 Hill Country Rd",
        "phone": "512-555-0199.0",
        "email": "admissions@ststephens.example.com",
        "description": "Exemplary preparatory academy",
        "type": ["private", "college-prep"],
        "grades": ["9", "10", "11", "12"],
        # The following columns MUST BE COMPLETELY IGNORED:
        "learning_models": ["montessori", "stem"],
        "extracurricular_programs": ["athletics", "robotics"],
        "open_enrollment": True,
        "full_address": "123 Hill Country Rd, Austin, TX 78746",
        "tuition": 25000,
    }

    payload = build_sandbox_payload(raw_data)

    # Active core fields
    assert payload["name"] == "St. Stephen's Academy"
    assert payload["website"] == "https://ststephens.example.com"
    assert payload["address"] == "123 Hill Country Rd"
    assert payload["phone"] == "512-555-0199"
    assert payload["email"] == "admissions@ststephens.example.com"
    assert payload["description"] == "Exemplary preparatory academy"
    assert payload["type"] == ["private", "college-prep"]
    assert payload["grades"] == ["9", "10", "11", "12"]
    assert payload["is_active"] is True

    # Ignored fields must NOT be present
    assert "learning_models" not in payload
    assert "extracurricular_programs" not in payload
    assert "open_enrollment" not in payload
    assert "full_address" not in payload
    assert "tuition" not in payload
