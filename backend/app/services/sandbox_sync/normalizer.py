"""Data sanitization and payload extraction for AWS RDS Sandbox database.

Strictly extracts active verified core fields while completely ignoring
specialized curriculum and enrollment columns (learning_models,
extracurricular_programs, open_enrollment, full_address).
"""

import json
import re
from typing import Any

_PLACEHOLDER_STRINGS = {"unknown", "none", "n/a", "not available", "null", "undefined"}


def sanitize_str(val: Any) -> str | None:
    """Strip null bytes and control characters while preserving newlines and trimming whitespace."""
    if val is None:
        return None
    if not isinstance(val, str):
        if not val:
            return None
        val = str(val)
    s = "".join(ch for ch in val if ch in ("\n", "\r", "\t") or ord(ch) >= 32)
    s = s.strip()
    return s if s else None


def is_meaningful_value(val: Any) -> bool:
    """Check if value is non-empty, non-null, and not a placeholder string."""
    if val is None:
        return False
    if isinstance(val, str):
        v = sanitize_str(val)
        if not v or v.lower() in _PLACEHOLDER_STRINGS:
            return False
        if "email" in v.lower() and "protected" in v.lower():
            return False
    elif isinstance(val, (list, dict, set, tuple)):
        if len(val) == 0:
            return False
        if isinstance(val, list):
            cleaned = [x for x in val if is_meaningful_value(x)]
            if len(cleaned) == 0:
                return False
    return True


def clean_phone_number(val: Any) -> str | None:
    """Clean phone number string, stripping trailing '.0' artifacts from numeric conversions."""
    if not val or not isinstance(val, str):
        return None
    val_clean = val.strip()
    if val_clean.endswith(".0") and val_clean[:-2].replace("-", "").isdigit():
        val_clean = val_clean[:-2]
    if not is_meaningful_value(val_clean):
        return None
    return val_clean


def normalize_address(addr: str | None) -> str:
    """Normalize address for deduplication/matching comparison."""
    if not addr:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", addr.lower())
    replacements = {
        r"\bst\b": "street",
        r"\brd\b": "road",
        r"\bave\b": "avenue",
        r"\bblvd\b": "boulevard",
        r"\bdr\b": "drive",
        r"\bln\b": "lane",
        r"\bste\b": "suite",
        r"\bapt\b": "apartment",
        r"\bpkwy\b": "parkway",
        r"\bfm\b": "farm to market",
    }
    for pattern, repl in replacements.items():
        cleaned = re.sub(pattern, repl, cleaned)
    return " ".join(cleaned.split())


def format_json_list(val: Any) -> list[str]:
    """Parse list, stringified JSON, or newline-delimited strings into a clean list of strings."""
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            val = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            if "\n" in val:
                val = [item.strip() for item in val.split("\n") if item.strip()]
            else:
                val = [val.strip()]
    elif not isinstance(val, list):
        val = [val] if val is not None else []

    cleaned: list[str] = []
    for item in val:
        if isinstance(item, str):
            item_str = sanitize_str(item)
            if not item_str or not is_meaningful_value(item_str):
                continue
            if item_str.startswith("[") and item_str.endswith("]"):
                try:
                    nested = json.loads(item_str.replace("'", '"'))
                    if isinstance(nested, list):
                        cleaned.extend(
                            [
                                sanitize_str(n)
                                for n in nested
                                if isinstance(n, str) and is_meaningful_value(n)
                            ]
                        )
                        continue
                except Exception:
                    pass
            cleaned.append(item_str)
        elif item is not None and is_meaningful_value(item):
            cleaned.append(str(item).strip())

    return [x for x in cleaned if x]


def build_sandbox_payload(school_data: dict[str, Any]) -> dict[str, Any]:
    """Extract strictly the requested active columns for Sandbox synchronization.

    Explicitly ignores:
    - learning_models
    - extracurricular_programs
    - open_enrollment
    - full_address (only `address` is used)
    """
    payload: dict[str, Any] = {}

    # 1. Name (Required)
    raw_name = school_data.get("name")
    name = sanitize_str(raw_name)
    if name:
        payload["name"] = name

    # 2. Website
    raw_website = school_data.get("website") or school_data.get("url")
    website = sanitize_str(raw_website)
    if website and is_meaningful_value(website):
        payload["website"] = website

    # 3. Address (Canonical - strictly ignoring full_address)
    raw_address = school_data.get("address")
    address = sanitize_str(raw_address)
    if address and is_meaningful_value(address):
        payload["address"] = address

    # 4. Phone
    phone = clean_phone_number(school_data.get("phone"))
    if phone:
        payload["phone"] = phone

    # 5. Email
    raw_email = school_data.get("email")
    email = sanitize_str(raw_email)
    if email and is_meaningful_value(email):
        payload["email"] = email

    # 6. Description
    raw_desc = school_data.get("description")
    desc = sanitize_str(raw_desc)
    if desc and is_meaningful_value(desc):
        payload["description"] = desc

    # 7. Type (JSONB list)
    raw_type = school_data.get("type")
    if raw_type is not None:
        type_list = format_json_list(raw_type)
        if type_list:
            payload["type"] = type_list

    # 8. Grades (JSONB list)
    raw_grades = school_data.get("grades")
    if raw_grades is not None:
        grades_list = format_json_list(raw_grades)
        if grades_list:
            payload["grades"] = grades_list

    # 9. is_active
    payload["is_active"] = True

    return payload
