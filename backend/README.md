# SchoolPath AI-DOP Backend (FastAPI + SQLAlchemy + uv)

Backend API service for the **SchoolPath AI Data Operations Platform (AI-DOP)**.

## Tooling Standards

- **Package Manager & Environment**: Managed strictly via **`uv`**.
- **No global system Python / No standard pip**: All dependencies reside in an isolated `.venv`.

## Architecture

Built following **Clean Architecture** principles:
- **`app/core/`**: Environment configuration, database engine, and session dependencies.
- **`app/models/`**: SQLAlchemy ORM entities with human-readable class and column names (`SchoolModel`, `DataProductModel`, `CrawlJobModel`, `EvidenceRecordModel`, `ResolvedValueModel`, `SourceRegistryModel`).
- **`app/schemas/`**: Pydantic v2 schemas for request validation and response serialization.
- **`app/api/`**: RESTful API routes (`/api/health`, `/api/schools`, etc.).
- **`app/main.py`**: FastAPI app entry point with CORS middleware and automatic SQLite table initialization and seeding.

## Setup & Running with `uv`

1. Initialize or sync environment (automatic with uv):
   ```bash
   cd backend
   uv sync
   ```

2. Run the FastAPI development server:
   ```bash
   uv run uvicorn app.main:app --reload --port 8000
   ```

3. Interactive Swagger API Docs:
   [http://localhost:8000/docs](http://localhost:8000/docs)
