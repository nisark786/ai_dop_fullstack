---
name: pydantic-validation
description: "Strict input data validation standards using Pydantic v2. Enforces whitespace stripping, cross-field integrity, string bounds, enum/literal types, and zero-raw-dict HTTP request policy across all backend endpoints."
risk: safe
date_added: "2026-09-28"
---

# Pydantic v2 Input Data Validation Skill

This skill defines the architecture, design patterns, and quality gates for input data validation across the FastAPI backend using **Pydantic v2**.

---

## 🧠 Core Philosophy
> **"Never trust client input; validate everything at the HTTP boundary."**  
> Every piece of data entering the application—via JSON body, form data, path parameters, or query strings—must be validated and sanitized before reaching the service layer or database.

---

## 1. Golden Rules of Input Validation

1. **Zero Raw Dicts & Untyped Bodies**:
   - NEVER use `payload: dict = Body(...)`, untyped `Any`, or arbitrary dictionaries in FastAPI endpoint signatures.
   - Always declare a dedicated Pydantic request model (`*Request` or `*Schema`).

2. **Automatic Whitespace Stripping**:
   - Every request model must define:
     ```python
     model_config = ConfigDict(str_strip_whitespace=True)
     ```
   - This ensures that `"   "` is converted to `""`, cleanly triggering `min_length` rejections rather than polluting the database with blank spaces.

3. **Explicit String & Numeric Bounds**:
   - Never use unbounded strings or numbers for user-provided data.
   - Always specify length limits: `Field(min_length=..., max_length=...)`.
   - Always specify numeric ranges: `Field(ge=0.0, le=100.0)`.

4. **Literal Types & Enums for Closed Sets**:
   - For fields with fixed allowed values (e.g. status, action, verification state), use `typing.Literal["opt1", "opt2"]` or an `Enum` instead of a generic `str`.

5. **Cross-Field Validation with `@model_validator(mode="after")`**:
   - When one field depends on another (e.g. `action == "link"` requires `link_school_id`, or manual school intake requires `name` plus at least `website` or `address`), enforce it with:
     ```python
     @model_validator(mode="after")
     def validate_cross_fields(self) -> Self:
         # validation logic
         return self
     ```

6. **Format & Semantic Sanitization**:
   - URLs and websites must be validated to have proper protocols or domain structures.
   - State codes should be validated or normalized to 2-letter uppercase or specific geographic regions.

---

## 2. Standard Model Pattern

```python
from typing import Literal, Self
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StandardEntityCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=2, max_length=255, description="Entity name")
    category: Literal["public", "private", "charter"] = Field(
        ..., description="Allowed category classification"
    )
    website: str | None = Field(
        None, max_length=500, description="Official portal URL"
    )
    address: str | None = Field(
        None, max_length=500, description="Physical address"
    )
    weight: float = Field(
        100.0, ge=0.0, le=100.0, description="Trust weight between 0 and 100"
    )

    @model_validator(mode="after")
    def validate_contact_info(self) -> Self:
        if not self.website and not self.address:
            raise ValueError("Either 'website' or 'address' must be provided.")
        return self
```

---

## 3. Pre-Merge Validation Checklist

Before completing any task that introduces or updates backend APIs:
- [ ] No endpoints accept raw `dict = Body(...)`.
- [ ] All request schemas configure `str_strip_whitespace=True`.
- [ ] All strings have `max_length` and sensible `min_length`.
- [ ] Numeric inputs have lower/upper bounds (`ge`, `le`).
- [ ] Actions, statuses, and types use `Literal[...]` or `Enum`.
- [ ] Dependent fields have `@model_validator(mode="after")`.
- [ ] Code passes `uv run ruff check app` and `uv run ruff format app`.
