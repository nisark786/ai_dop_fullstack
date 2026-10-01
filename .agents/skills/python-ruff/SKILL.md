---
name: python-ruff
description: "Automated linting, formatting, and static analysis for Python backend code using Ruff via `uv`. Enforces modern Python 3.12+ syntax, isort import ordering, and Black-compatible formatting before code changes ship."
risk: safe
date_added: "2026-09-09"
---

# Python Ruff Quality & Formatting Skill

This skill enforces high-speed, automated code quality, linting, and formatting across all Python backend files in `backend/` using **Ruff** managed via **`uv`**.

---

## 🧠 Core Philosophy
> **"Never ship unlinted or unformatted Python code."**  
> Every Python modification must pass `ruff check` and be formatted with `ruff format` before presenting to the user or committing.

---

## 1. When to Invoke This Skill
Invoke this skill:
- Immediately after writing, editing, or refactoring any Python file (`*.py`) in `backend/app/` or `backend/scratch/`.
- Before presenting final diffs, walkthroughs, or completing user tasks.
- When resolving syntax errors, circular imports, or code smells.
- During pull request reviews or repository health audits.

---

## 2. Standard Commands (Strictly via `uv`)

All commands must be run from inside the `backend/` directory or with `cd backend`:

| Task | Command | Description |
| :--- | :--- | :--- |
| **Lint Check** | `uv run ruff check app` | Scans for errors, undefined names, unused variables, and imports. |
| **Auto-Fix** | `uv run ruff check --fix app` | Automatically fixes all safe linting issues and organizes imports (isort). |
| **Format** | `uv run ruff format app` | Enforces double quotes, consistent indentation, and trailing commas. |
| **Format Verify** | `uv run ruff format --check app` | Validates that files adhere to formatting standards without modifying them. |

---

## 3. Configuration & Ignored Rules Context

Ruff configuration is maintained in [`backend/pyproject.toml`](../../backend/pyproject.toml) under `[tool.ruff]`:
- **Line Length**: `100` characters.
- **Target Version**: `py312` (Python 3.12+ modern typing, using `X | None` instead of `Optional[X]`, and `list[T]` instead of `List[T]`).
- **Rule Sets Enabled**:
  - `E`, `W`: pycodestyle errors and warnings.
  - `F`: Pyflakes (undefined variables, unused imports).
  - `I`: isort (strict import sorting).
  - `B`: flake8-bugbear (common design pitfalls).
  - `UP`: pyupgrade (modern Python 3.12 idioms).
  - `C4`: flake8-comprehensions.
  - `SIM`: flake8-simplify.
- **Project-Specific Ignores**:
  - `E501`: Line too long (delegated to the formatter).
  - `B008`: FastAPI `Depends(...)` in endpoint default argument values.
  - `E712`: SQLAlchemy boolean column comparisons (`Schools.is_active == True`).

---

## 4. Pre-Delivery Verification Checklist

Before finishing any Python backend task:
- [ ] Run `uv run ruff check app` and verify exit code is `0` (`All checks passed!`).
- [ ] Run `uv run ruff format --check app` and verify all files are formatted.
- [ ] Run `uv run python -c "import app.main"` to verify that import reordering did not introduce circular dependencies.
