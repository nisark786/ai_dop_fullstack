# Workspace Operational Rules

## 1. Package Managers & Environment
- **Backend (Python)**:
  - Exclusively use `uv` (`uv init`, `uv venv`, `uv add`, `uv run`).
  - Do NOT use standard `pip` or system Python directly.
  - Work inside an isolated `.venv` managed by `uv`.
- **Frontend (Node.js/React)**:
  - Exclusively use `pnpm` (`pnpm install`, `pnpm dev`, `pnpm build`).
  - Do NOT use `npm` or `yarn`.

## 2. Code Quality, Naming & Automated Linting
- Follow Clean Architecture, SOLID principles, and human-readable, intention-revealing names.
- **Backend Linting & Formatting (Ruff)**:
  - All Python code modifications must pass `uv run ruff check app` with 0 errors.
  - Format all Python files with `uv run ruff format app` before committing or completing tasks.
- **Frontend Quality (Oxlint & TypeScript)**:
  - Verify static types with TypeScript (`tsc -b`) and lint with `pnpm lint` (Oxlint).

## 3. Database Safety & Inspection
- **Remote / QA / Prod DBs**:
  - Treat all remote databases as sensitive live environments.
  - Strictly READ-ONLY operations. NEVER execute `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, or `TRUNCATE`.
  - Always set query timeouts (`statement_timeout = '5000'`).
  - Never execute heavy queries, full-table scans, or unbounded `COUNT(*)` that could lock tables or crash the database. Always use `LIMIT 5` or catalog table stats (`pg_stat_user_tables`).

## 4. Documentation Maintenance & Sync
- **Continuous Documentation**:
  - Whenever new features, endpoints, configuration parameters, dependencies, architectural changes, or bug fixes are created or updated, you MUST update `docs/DEVELOPER_GUIDE.md` to reflect the latest changes.
  - Keep the directory structure, environment variables, API endpoints, build instructions, and troubleshooting sections synchronized with the live codebase.
  - Never leave documentation outdated after making code modifications.

## 5. Secrets Management & Zero-Hardcoding Policy
- **Zero Hardcoded Secrets**:
  - NEVER hardcode API keys, passwords, bearer tokens, or database connection strings in source code, configuration files, test files, scripts, or documentation.
  - Exclusively load credentials and secrets from environment variables or `.env` files.
- **Git Protection & `.env.example`**:
  - NEVER commit `.env` files to git. Ensure all `.gitignore` files explicitly ignore `.env` and `.env.*` (while retaining `.env.example`).
  - Keep `.env.example` continuously updated with safe, non-sensitive placeholders whenever new environment variables are added.
- **Log Sanitization**:
  - Never log raw authentication tokens, secret keys, or passwords in console or server logs. Mask sensitive strings before logging.

## 6. Input Validation & Pydantic Standards
- **Zero Raw Dicts & Untyped Bodies**:
  - NEVER accept raw `dict`, unvalidated `Body(...)`, or untyped JSON payloads in FastAPI route handlers.
  - Every mutation endpoint (`POST`, `PUT`, `PATCH`, `DELETE` with payload) MUST be backed by a strictly typed Pydantic v2 model.
- **Pydantic v2 Best Practices**:
  - Always enable `model_config = ConfigDict(str_strip_whitespace=True)` to prevent whitespace injection.
  - Enforce bounds on all strings (`min_length`, `max_length`) and numbers (`ge`, `le`).
  - Use `Literal[...]` or Enums for all closed-set values (actions, statuses, categories).
  - Implement `@model_validator(mode="after")` for all cross-field integrity and dependency checks.

## 7. Explicit Imports & Clean Organization
- **Explicit Imports**:
  - Every file must explicitly import the modules, functions, and classes it directly needs.
  - NEVER use wildcard imports (`from module import *` or `import *`).
  - Never rely on implicit transitive re-exports across non-barrel modules.
- **Clean Organization**:
  - Keep your import statements transparent so that code dependencies are obvious at a glance.
  - Maintain standardized import grouping:
    1. Standard library modules (e.g., `os`, `sys`, `typing`, `datetime`)
    2. Third-party packages (e.g., `fastapi`, `pydantic`, `sqlalchemy`, `react`, `lucide-react`)
    3. Internal application modules (e.g., `app.core`, `app.models`, `../services/api`)
  - Strictly prune unused imports and maintain automated sorting via `uv run ruff check --fix app` (Python/isort) and `pnpm lint` (TypeScript).


