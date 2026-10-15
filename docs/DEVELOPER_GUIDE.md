# SchoolPath AI-DOP — Developer Onboarding & System Architecture Guide

Welcome to the **SchoolPath AI Data Operations Platform (AI-DOP)** codebase. This document is a complete, self-contained guide designed to help any new developer understand, install, run, debug, and contribute to this project from day one without needing prior context.

---

## 1. Project Overview & Mission

### What is SchoolPath AI-DOP?
SchoolPath AI-DOP is an enterprise data intelligence and quality-assurance platform designed to answer high-stakes parent questions (such as: *"Which schools near me have Grade 1 open seats?"*, *"What are real tuition rates?"*, and *"Which schools support specific Special Education / SPED programs?"*).

Because school websites are unstructured, constantly changing, or listed inaccurately on aggregator portals (like GreatSchools, Niche, or Facebook), AI-DOP combines:
1. **Autonomous Web Crawlers & AI Agents** (using Tavily for discovery, Firecrawl for scraping, and OpenAI LLMs e.g. `gpt-6-luna` for validation).
2. **ERCIE (Evidence Resolution & Confidence Inference Engine)** to resolve conflicting data from multiple sources.
3. **Human-in-the-Loop (HITL) Review Queue** for low-confidence or high-conflict records.
4. **Dynamic Source Authority Scoring** that learns from human reviewer decisions over time.

---

## 2. Technology Stack & Mandatory Standards

Per the project operational rules in `AGENTS.md`, specific package managers and architectural standards **must strictly be followed**:

| Layer | Technology | Mandatory Tooling Standard |
| :--- | :--- | :--- |
| **Backend API** | Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 | **Exclusively use `uv`** (`uv sync`, `uv run`). Do NOT use raw `pip` or system Python. |
| **Code Quality** | Ruff (Backend), Oxlint (Frontend) | `uv run ruff check` & `uv run ruff format` for Python; `pnpm lint` for React. |
| **Frontend UI** | React 19, TypeScript 6, Vite 8, Tailwind CSS v4, Lucide React, React Router v7, **Axios**, **Zustand** | **Exclusively use `pnpm`** (`pnpm install`, `pnpm dev`, `pnpm build`). Do NOT use `npm` or `yarn`. |
| **Databases** | Supabase PostgreSQL (Production/QA) + local SQLite fallback (`schoolpath_dev.db`) | Strictly **READ-ONLY** on remote/QA databases with `statement_timeout = 5000`. |
| **AI & Scraping** | OpenAI (`OPENAI_MODEL=gpt-6-luna`), Firecrawl API, Tavily Search API | Rate-limited scraping (6-second minimum cooldown via `FirecrawlRateLimiter`). |

---

## 3. System Architecture & Repository Layout

```
data_pipeline_fullstack/
├── AGENTS.md                                # Workspace operational & DB safety rules
├── docs/
│   ├── DEVELOPER_GUIDE.md                   # This developer onboarding guide
│   ├── PHASE_1_FRD.md                       # Phase 1 Functional Requirements Document (UI / Control Layer)
│   ├── TASKS.md                             # Granular implementation tasks & progress tracking
│   └── SchoolPath_AI-DOP_Complete_System_Spec.docx  # Master 25-section system spec
├── backend/
│   ├── app/
│   │   ├── main.py                          # FastAPI application entry point with CORS & router mount
│   │   ├── core/
│   │   │   ├── config.py                    # ApplicationSettings (reads .env, normalizes DB URL)
│   │   │   └── database.py                  # SQLAlchemy engine, sessionmaker & get_database_session
│   │   ├── models/                          # SQLAlchemy ORM Domain Models (50+ tables)
│   │   │   ├── __init__.py                  # Master re-export of all domain models
│   │   │   ├── schools.py                   # Master school entities (Schools, SchoolTiers, etc.)
│   │   │   ├── metadata_output.py           # Metadata Agent outputs (MetadataAgentOutputModel)
│   │   │   ├── scraper_cache.py             # Scraped page cache (ScrapedPageCacheModel)
│   │   │   ├── pipeline.py                  # Pipeline models (CrawlJobModel, EvidenceRecordModel, etc.)
│   │   │   ├── admissions.py                # Admissions, appointments, leads, intake models
│   │   │   ├── analytics.py                 # Activity logs, audit logs, visitor tracking
│   │   │   ├── reviews.py                   # Reviews, themes, sentiment summaries
│   │   │   └── users.py                     # Users, families, children, child school match
│   │   ├── schemas/
│   │   │   ├── batch.py                     # Pydantic v2 schemas for batches, intake, and trash retention
│   │   │   ├── school.py                    # Pydantic v2 schemas for school queries and updates
│   │   │   ├── source.py                    # Pydantic v2 schemas for source registry & weight updates
│   │   │   ├── review.py                    # Pydantic v2 schemas for HITL ERCIE review queue
│   │   │   └── job.py                       # Pydantic v2 schemas for crawler and extraction jobs
│   │   ├── services/                        # Business logic & background workers
│   │   │   ├── batches/                     # Batch intake, file parsers, and templates
│   │   │   └── agents/                      # Background multi-threaded batch agent orchestrator
│   │   ├── pipelines/audit_crawler/         # Autonomous 3-Agent DQA Crawler
│   │   │   ├── planning_agent.py            # Aggregator detection & Tavily official site finder
│   │   │   ├── extraction_agent.py          # Firecrawl scraper, markdown cleaner & LLM extractor (gpt-6-luna)
│   │   │   ├── audit_service.py             # Full school audit & reactivation orchestrator
│   │   │   ├── rate_limiter.py              # Enforces 6-second cooldown between web scrapers
│   │   │   └── schemas.py                   # DQAReport, Recommendation, EvidenceSource schemas
│   │   └── api/
│   │       ├── router.py                    # Aggregator mounting all /api sub-routers
│   │       └── routes/
│   │           ├── health.py                # GET /api/health (Database & service health)
│   │           ├── schools.py               # GET /api/schools, GET /api/schools/stats, PATCH /schools/{id}
│   │           ├── audit.py                 # POST /api/pipelines/audit/run/{id}, /status, /run-batch
│   │           ├── jobs.py                  # GET /api/jobs, POST /api/jobs/start, POST /api/jobs/{id}/retry
│   │           ├── review.py                # GET /api/review, POST /{id}/approve, /{id}/correct, /{id}/reject
│   │           ├── sources.py               # GET /api/sources, PATCH /api/sources/{id}/weight
│   │           ├── published.py             # GET /api/published (Verified golden dataset)
│   │           └── prompts.py               # GET /api/prompts (Prompt Studio KPI metrics)
│   ├── alembic/                             # Alembic migrations (e.g. 1a6e80ac50b6_initial_qa_schema.py)
│   ├── pyproject.toml                       # Python dependencies definition
│   ├── uv.lock                              # Locked dependency versions
│   └── .env                                 # Backend environment variables
└── frontend/
    ├── src/
    │   ├── main.tsx                         # React 19 app bootstrap with BrowserRouter
    │   ├── App.tsx                          # App shell, navigation routing, toast alerts & Copilot drawer
    │   ├── types/
    │   │   └── index.ts                     # Authoritative TypeScript interfaces & domain models
    │   ├── services/
    │   │   ├── client.ts                    # Centralized Axios client (interceptors, FastAPI 422 parser)
    │   │   └── api.ts                       # Strongly-typed API interface layer delegating to client.ts
    │   ├── stores/                          # Domain-driven Zustand global stores
    │   │   ├── index.ts                     # Barrel export of all Zustand stores
    │   │   ├── appStore.ts                  # Global shell, RBAC roles, toast alerts, Copilot drawer
    │   │   ├── batchStore.ts                # Batches listing, KPIs, optimistic school membership
    │   │   ├── trashStore.ts                # Global Trash Bucket, retention countdown, purge
    │   │   ├── schoolStore.ts               # Master School Library (100k+ rows, filters, server pagination)
    │   │   ├── agentStore.ts                # AI Agents registry, multi-batch runs, live job polling
    │   │   ├── reviewStore.ts               # ERCIE HITL review queue, approvals, inline corrections
    │   │   ├── governanceStore.ts           # Source ranking weights, golden records, Prompt Studio
    │   │   └── batchRunStore.ts             # Historical batch runs, detail inspection, HTML/Excel/CSV exports
    │   ├── utils/
    │   │   └── download.ts                  # Browser DOM file saving utility for Blob exports
    │   ├── components/
    │   │   ├── Header.tsx                   # Top header with RBAC role switcher (Admin/Reviewer/Viewer)
    │   │   ├── Sidebar.tsx                  # Navigation bar with badges & pipeline section grouping
    │   │   ├── CopilotDrawer.tsx            # AI Copilot assistant side-drawer
    │   │   ├── ercie/
    │   │   │   ├── ConfidenceBreakdown.tsx  # 4-factor confidence bar visualization
    │   │   │   └── MatchmakingPanel.tsx     # Candidate source comparison & support ranking
    │   │   ├── batches/                     # Modular batch intake, tables, & modal components
    │   │   ├── agents/                      # Metadata agent runner & audit drawers
    │   │   └── schools/                     # School detail, edit, create, and batch assignment modals
    │   └── pages/
    │       ├── DashboardView.tsx            # High-level operational metrics & pipeline status
    │       ├── SchoolLibraryView.tsx        # Master school management, filtering, & bulk batch assignment
    │       ├── BatchListView.tsx            # Batches master catalog for active operational batches
    │       ├── BatchDetailView.tsx          # Batch details, membership, and school intake progress
    │       ├── CreateBatchView.tsx          # 3-step progressive Excel/CSV batch intake wizard
    │       ├── TrashBucketView.tsx          # Global 30-day quarantine trash bucket & maintenance
    │       ├── AgentsOperateView.tsx        # Multi-batch AI agent dispatch & live execution monitor
    │       ├── CostMonitorView.tsx          # Real-time OpenAI token & cost tracking dashboard
    │       ├── CrawlPipelinesView.tsx       # Batch crawler dashboard with live progress polling
    │       ├── ReviewQueueView.tsx          # ERCIE HITL decision console (Approve / Correct / Reject)
    │       ├── JobMonitorView.tsx           # Execution log & crawler retry console
    │       ├── SourceRankingView.tsx        # Dynamic authority weights & accuracy drift
    │       ├── PublishedDataView.tsx        # Golden records catalog
    │       ├── PromptStudioView.tsx         # Prompt templates & LLM accuracy KPIs
    │       └── PipelineEmptyView.tsx        # Spec placeholders for ETL, Schedules & Anomalies
    ├── package.json                         # Frontend dependencies definition
    ├── pnpm-lock.yaml                       # Locked dependency versions
    ├── vite.config.ts                       # Vite 8 configuration
    └── .env                                 # Frontend environment variables
```

---

## 4. Initial Setup & Installation Guide

### Prerequisites
Make sure your development machine has:
1. **Python 3.12+**
2. **`uv` package manager**:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
3. **Node.js 20+ or 22+**
4. **`pnpm` package manager**:
   ```bash
   npm install -g pnpm
   # Or standalone: curl -fsSL https://get.pnpm.io/install.sh | sh -
   ```

---

### Step 1: Environment Variables Configuration

#### 1. Backend `.env` (`backend/.env`)
Create or verify `backend/.env` containing:
```env
# Database Connection (Supabase PostgreSQL pooler or SQLite fallback)
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres

# Target table for school records
TARGET_TABLE=schools

# API Keys for Autonomous Crawling & Audit Pipeline
OPENAI_API_KEY=sk-svcacct-...
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...
TAVILY_API_KEY=tvly-dev-...
```

#### 2. Frontend `.env` (`frontend/.env`)
Create or verify `frontend/.env` containing:
```env
# Point Vite frontend to the FastAPI backend API port
VITE_API_BASE_URL=http://localhost:8001/api
```

---

### Step 2: Install Backend Dependencies

From the repository root:
```bash
cd backend
uv sync
```
*Note: `uv` creates and populates an isolated `.venv` with all 52 dependencies including FastAPI, SQLAlchemy, Alembic, psycopg2-binary, and AI SDKs.*

---

### Step 3: Install Frontend Dependencies

From the repository root:
```bash
cd frontend
pnpm install
```
*Note: `pnpm` links all dependencies into `frontend/node_modules/` including React 19, Tailwind CSS v4, Lucide React, and TypeScript.*

---

## 5. Running the Application Locally

Run the backend and frontend in separate terminal windows:

### Terminal 1: Start Backend API
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8001
```
- **Root**: [http://localhost:8001](http://localhost:8001)
- **Health Check**: [http://localhost:8001/api/health](http://localhost:8001/api/health)
- **Interactive Swagger Documentation**: [http://localhost:8001/docs](http://localhost:8001/docs)

> **Why Port 8001?** If port `8000` is in use by another local system process, port `8001` is used. The frontend is pre-configured to communicate with port `8001`.

### Terminal 2: Start Frontend UI
```bash
cd frontend
pnpm dev
```
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)

### Code Quality & Linting Commands

#### Backend (Ruff)
```bash
cd backend
# Check for lint errors and unused imports
uv run ruff check .

# Automatically fix lint issues and sort imports
uv run ruff check --fix .

# Format code (replaces Black)
uv run ruff format .
```

#### Automated Backend Test Suite (Pytest)
```bash
cd backend
# Run full pytest test suite (228 tests passing)
uv run pytest tests/ -v

# Run a specific test module
uv run pytest tests/api/test_batches.py -v

# Run with short traceback on failures
uv run pytest tests/ --tb=short
```

> **Test Infrastructure Architecture:**
> - **In-Memory SQLite Isolation**: All tests run against an in-memory SQLite database (`conftest.py`) with automatic rollback per test.
> - **PostgreSQL Compatibility Shims**: Dynamic type adapters (`_patch_pg_types_for_sqlite`) map Postgres `JSONB` and `UUID` to SQLite types.
> - **UUID Bind Processor**: SQLite binds string UUIDs safely via `_patch_uuid_bind_processor`.
> - **Zero External Network Dependencies**: Tavily search, Firecrawl scraping, and OpenAI LLM calls are mocked.
> - **Test Coverage**: 228 tests across all 13 API route files, 3 service layers, and 2 unit utility modules.

#### Frontend (Oxlint & TypeScript)
```bash
cd frontend
# Run fast Oxlint checks
pnpm lint

# Static type check
pnpm exec tsc -b
```

---

## 6. Core Subsystems & How They Work

### 6.1. Centralized API Architecture in Frontend
All HTTP requests across the entire frontend application are centralized in **`frontend/src/services/api.ts`**.
- **Rule**: Never call `fetch()` directly inside a React component or page. Always define or call methods via `api.<methodName>()`.
- **Envelope Handling**: The backend `/api/schools` endpoint returns a paginated envelope:
  ```json
  {
    "items": [...],
    "total": 1905,
    "page": 1,
    "page_size": 50,
    "total_pages": 39
  }
  ```
  `api.ts` safely extracts `data.items` so that UI components receive clean arrays without breaking.

---

### 6.2. Autonomous 3-Agent DQA Audit Pipeline
Located in `backend/app/pipelines/audit_crawler/`:
1. **Planning Agent (`planning_agent.py`)**:
   - Detects if an existing school URL is dead, missing, or an aggregator (e.g. Facebook, GreatSchools, Niche, Yelp).
   - Queries Tavily Search API + configured LLM (`settings.openai_model`) to locate the official school domain and maps subpages (`/admissions`, `/academics`, `/tuition`, `/contact`).
2. **Extraction Agent (`extraction_agent.py`)**:
   - Scrapes selected pages with Firecrawl.
   - Enforces rate limiting (`rate_limiter.py` with 6-second cooldown) to protect API quotas.
   - Cleans markdown text (strips navigation bars, footers, image tags) to minimize LLM token consumption.
   - Prompts configured LLM (`settings.openai_model`, default: `gpt-6-luna`) with structured JSON schemas to validate names, addresses, phones, and grades.
3. **School Audit Service (`audit_service.py`)**:
   - Compares current database records with extracted evidence.
   - If confidence >= 75%, automatically reactivates the school (`is_active = True`, `profile_verification_status = 'verified'`).
4. **Batch Worker**:
   - Accessible via `/api/pipelines/audit/run-batch`.
   - Runs in a FastAPI `BackgroundTask`, updating `batch_progress` in memory.
   - The frontend (`CrawlPipelinesView.tsx`) polls `/api/pipelines/audit/status` every 2 seconds to render live progress bars and execution logs.

---

### 6.3. ERCIE (Evidence Resolution & Confidence Inference Engine)
Located in `backend/app/api/routes/review.py` and `frontend/src/components/ercie/`:
- Groups multiple candidates for a single attribute (e.g., Grade 1 open seats = 12 vs 8).
- Calculates the 4-component confidence score:
  1. **Support Strength (40%)**: Winning value support / Total support
  2. **Source Agreement (30%)**: Agreeing sources / Total sources
  3. **Freshness (20%)**: Age decay of scraped evidence
  4. **Historical Consistency (10%)**: Deviation from previous baseline
- **Decision Bands**:
  - >= 90% -> **Auto Publish**
  - 75% - 89% -> **Reviewer Approval**
  - 50% - 74% -> **Mandatory HITL Review**
  - < 50% -> **Escalation Required**

---

### 6.4. Dynamic Source Ranking
Located in `backend/app/api/routes/sources.py`:
- Tracks accuracy across 3 source categories:
  - **Category 1**: Official School Portals (`.edu`, `.org`, verified domains)
  - **Category 2**: Official Social & Press Channels
  - **Category 3**: External Aggregators & Directories
- Computes effective weight automatically based on reviewer feedback:
  Effective Weight = Configured Weight * (Historical Accuracy / 100)

---

### 6.3. Batch Management & School Intake Validation
Located in `backend/app/services/batches/` and `frontend/src/components/batches/`:
- **Clean Architecture Modular Architecture**:
  - `backend/app/services/batches/`:
    - `file_parser.py`: Pure Excel and CSV file intake parsing.
    - `deduplicator.py`: Domain and fuzzy duplicate matching against school catalog.
    - `school_factory.py`: ORM school instantiation with schema defaults.
    - `template_service.py`: Standard Excel intake template generation.
    - `batch_service.py`: Core batch lifecycle, school membership, and trash maintenance orchestration.
  - `frontend/src/components/batches/`:
    - `BatchKpiCards.tsx`: 4 summary KPI cards.
    - `ActiveBatchesTable.tsx`: Filterable active batches table with row actions.
    - `TrashBatchesTable.tsx`: 30-day Trash Bucket table with countdown chips.
    - `EditBatchModal.tsx`: Tabbed modal for batch info and school add/drop membership.
    - `DeleteBatchModal.tsx`: Warning confirmation modals for soft delete and permanent purge.
- **Validation Rules**:
  - **School Name**: Strictly mandatory (`name` must not be blank).
  - **Identifiers**: At least one identifier (**Website** OR **Address**) must be provided. If both are missing, the intake row is marked invalid with `At least one identifier (Website or Address) must be provided.`
  - **Maximum Limits**: 10 MB per file, 5,000 rows max per batch upload.
- **Duplicate Detection**:
  - Performs read-only exact domain matching and case-insensitive name matching against existing schools.
  - Operators can choose to either **Link Existing** or **Create New** entity during batch confirmation.
- **Prototype-Fidelity UI Design & Operational Actions**:
  - **Sidebar Rail**: Deep Navy (`#0A1F3C`) with Royal Blue active markers (`#2563EB`).
  - **Screen Routes**:
    - `/batches`: "All batches" management table focusing purely on operational batch management:
      - **Open**: Navigates to `/batches/:id` detail view.
      - **Edit**: Tabbed modal to update Batch Name/Description and directly **Add/Drop Schools** to/from the batch.
      - **Delete**: Soft-deletes the batch with a warning confirmation modal explaining the 30-day retention policy.
    - `/trash`: Dedicated **Trash Bucket** view (Unified Multi-Entity System):
      - Positioned at the bottom of the sidebar navigation.
      - Supports multi-entity switching via tab pills (**Batches** and **Schools**).
      - Retains soft-deleted batches and master schools for 30 days before permanent deletion.
      - Features live `days_remaining` retention countdown, one-click **Restore** button, and **Delete Forever** action for both entity types.
      - **Automated Background Worker**: Runs every 24 hours on the FastAPI lifespan handler to auto-purge batches and schools where `deleted_at > 30 days`. Also supports on-demand purge via `POST /api/batches/trash/purge-expired` and `POST /api/schools/trash/purge-expired`.
    - `/batches/create`: Dedicated 3-step progressive intake flow (1. Batch Name, 2. Drop Zone + Template Download + Invalid Rows CSV Export, 3. Live Validation Preview with status breakdown chips and Master Duplicate Resolution toggles). Routed via `useBatchStore.createBatch()`.
    - `/batches/:id`: Streamlined Batch Detail view with interactive Batch Switcher Pills, visual stacked progress snapshot, "+ Add School" modal, client-side pagination (25/50/100 per page), multi-select school checkboxes with floating bulk action bar, and bulk school dropping.
  - **API Endpoints**:
    - `GET /api/batches`: Lists active batches (filters out soft-deleted items by default).
    - `GET /api/batches/trash`: Lists batches currently quarantined in the Trash Bucket with calculated `days_remaining`.
    - `POST /api/batches/trash/purge-expired`: Manually triggers purge of batches in trash older than retention threshold (default 30 days).
    - `PATCH /api/batches/{id}`: Updates batch name and description.
    - `DELETE /api/batches/{id}`: Soft-deletes a batch by setting `deleted_at = UTC_TIMESTAMP` and `status = 'trashed'`. Returns `HTTP 409 Conflict` if crawling or extraction jobs are actively running.
    - `POST /api/batches/{id}/restore`: Restores a trashed batch to active status (`deleted_at = None`, `status = 'ready'`).
    - `DELETE /api/batches/{id}/permanent`: Irreversibly purges a batch and cascading relations. Returns `HTTP 409 Conflict` if jobs are actively running.
    - `POST /api/batches/{id}/schools`: Adds a school to the batch (links existing from library or creates new).
    - `DELETE /api/batches/{id}/schools/{school_id}`: Drops a school from the batch without deleting master entity, soft-deleting staging records and cancelling pending review items (Orphan Guard).
    - `POST /api/batches/{id}/schools/bulk-drop`: Drops multiple schools from a batch simultaneously, updating remaining counts and cancelling pending review outputs.
    - `GET /api/schools/trash`: Lists schools currently quarantined in the Trash Bucket with calculated `days_remaining`.
    - `POST /api/schools/{school_id}/restore`: Restores a trashed school back to active master catalog (`deleted_at = None`, `is_active = True`).
    - `DELETE /api/schools/{school_id}/permanent`: Irreversibly purges a school and its associated crawler data.
    - `POST /api/schools/trash/purge-expired`: Purges quarantined schools older than retention threshold.
  - **Active Navigation (Scope 1 Focus)**:
    - Frontend sidebar navigation is focused strictly on **Dashboard** and **Batch Management** during Milestone 1. Passive 6-second auto-polling updates batch status when agents are running.

---

### 6.4. School Profile & Metadata Agent (gpt-6-luna + Firecrawl + Tavily)
Located across `backend/app/pipelines/audit_crawler/` and `frontend/src/components/agents/`:
- **Model Engine**: Powered by `gpt-6-luna` (configured via `OPENAI_MODEL=gpt-6-luna`), replacing deprecated 4o models.
- **Safety Rate Limiters**: Thread-safe `ApiRateLimiter` enforces global cooldowns (Firecrawl: 6.0s spacing, Tavily: 1.5s spacing) with `KeyRotator` for graceful multi-key failover.
- **Intelligence Pipeline**:
  - **ISD District & Campus Resolver**: Detects aggregator links and district portals (`is_district_portal`), querying Tavily + `gpt-6-luna` to locate exact campus subdomains/URLs.
  - **Schema Knowledge Base**: Strict canonical allowed values for `type` (`"Public"`, `"Charter"`, `"Private"`, `"Magnet"`), `gender` (`"Co-ed"`, `"All-Female"`, `"All-Male"`), and standard grade designations (`"PK"`, `"KG"`, `"1"` through `"12"`).
  - **9-Rule Extraction Engine**:
    1. Identity Check: verifies school name match before updating fields.
    2. 3-Tier Grade Hierarchy: Tier 1 explicit table/page > Tier 2 application forms > Tier 3 contextual text.
    3. Age $\neq$ Grade rule: converts ages (e.g. 3-4 yrs $\rightarrow$ PK/KG, never raw numbers).
    4. Enforces strict schema constraints and non-null guarantees.
- **Execution Endpoint**:
  - `POST /api/batches/{id}/run-metadata-agent`: Dispatches agent across single school, selected group, or whole batch with priority (`low`, `normal`, `high`).
- **Frontend Components**:
  - `RunMetadataAgentModal.tsx`: Accessible modal with engine badges (`gpt-6-luna`), scope selection, queue priority, and safety indicator.
  - `MetadataAuditDrawer.tsx`: Slide-out inspection drawer rendering quality score chips, field diffs (Current vs Recommended), confidence percentages, reasons, and verbatim quotes with source links.
  - `BatchDetailView.tsx`: Integrated `School Info (Metadata)` primary product column with live status badges (`Not Run`, `Queued`, `Running...`, `Verified`, `Needs Review`), periodic 3s polling for active runs, and bulk execution triggers.

---

### 6.5. AI Agents Operations Control Plane (FR-4, FR-5, FR-7)
Located across `backend/app/api/routes/agents.py`, `backend/app/schemas/agents.py`, and `frontend/src/pages/AgentsOperateView.tsx`:
- **Functional Requirements**: Meets FR-4.1 - FR-4.5 (Agent & Data Product Registry), FR-5.1 - FR-5.6 (Agent Execution & Scope Control), and FR-7.1 - FR-7.4 (Live Job Monitoring).
- **Architecture**:
  - **Dynamic Agent Registry**: Dedicated registry containing the integrated, active School Profile & Metadata Agent (`metadata_agent_v1`, product key `info`), executed via `gpt-6-luna`. Unimplemented placeholder stubs have been completely purged to avoid operator confusion.
  - **Multi-Batch Concurrent Execution**: Accepts a list of target batch IDs (`batch_ids: list[UUID]`) and agent keys (`agent_keys: list[str]`). Automatically queues and schedules implemented agents across all selected batches concurrently in background tasks.
  - **Real-Time Multi-Batch Monitoring**: Computes live school completion and running counts across all selected batches directly from batch membership records. Emits composite progress metrics, progress bar percentages, and status tags (`pending`, `running`, `completed`, `failed`).
- **Endpoints**:
  - `GET /api/agents/registry`: Returns full catalog of registered data products, models, versions, and readiness.
  - `POST /api/agents/run-for-batch`: Dispatches selected agents across schools in one or multiple target batches (`batch_ids`).
  - `GET /api/agents/jobs`: Returns live execution progress, elapsed seconds, and metrics across target batches with 3-second UI polling.
  - `POST /api/agents/jobs/{job_id}/pause`: Pauses in-flight job safely targeting only the specific batch linked to that job (`_resolve_batch_for_job`).
  - `POST /api/agents/jobs/{job_id}/resume`: Resumes remaining unverified schools targeting the specific batch linked to that job.
  - `POST /api/agents/jobs/{job_id}/cancel`: Cancels the job and resets crawling schools to pending, isolated strictly to the target batch.
- **Background Worker & Lifecycle**:
  - Automatically transitions `batch.status = "completed"` once all schools in a batch reach terminal verification.
  - Filters out soft-deleted/dropped staging schools (`deleted_at.is_(None)`) in whole-batch agent triggers.
- **Frontend Components**:
  - `AgentsOperateView.tsx`: Dual-panel operational control screen:
    - **Target Batches Panel**: Real-time batch name search, "Select All" / "Clear", checkboxes, school count badges, status tags, and fixed-height scrollable list (`max-h-[380px]`).
    - **AI Agents Panel**: Real-time agent/field keyword search, "Select Active" / "Clear", selection checkboxes (enabled for Metadata Agent, locked for Phase 2), version badges, and fixed-height scrollable list (`max-h-[380px]`).
    - **Action Trigger Bar**: Summary of selected batches, total schools, concurrency slider (1–5 workers with 6.0s spacing), cache bypass toggle, and single `[▶ Start Running]` action dispatched via `useAgentStore`.
    - **Live Execution Monitor**: Multi-batch aggregate progress bar and per-batch live execution status cards with 3-second polling, live elapsed runtime display, stale run detection with force reset, and direct `[Review Outputs →]` shortcut to the Review Queue on completed jobs.
  - `Sidebar.tsx`: Includes dedicated **AI AGENTS** navigation group linking to `/agents`.

---

### 6.6. Global OpenAI Cost Logger & Token Monitor
Located across `backend/app/cost_tracking/`, `backend/app/api/routes/costs.py`, and `frontend/src/pages/CostMonitorView.tsx`:
- **Architecture**:
  - **Thin Wrapper Pattern (`CostTrackingOpenAIClient`)**: A non-invasive proxy that wraps official `OpenAI` client instances without monkey-patching. Provides transparent proxying for structured outputs (`beta.chat.completions.parse`) and standard completions (`chat.completions.create`).
  - **Context Propagation (`contextvars`)**: Maintains asynchronous, thread-safe execution context (`agent_name`, `school_id`, `batch_id`, `task_name`) across long-running agent crawls without polluting function signatures.
  - **Database Persistence with Graceful JSONL Fallback (`recorder.py`)**: Stores usage in PostgreSQL table `openai_cost_logs` (managed via Alembic migration `f5b7218ac93d_add_openai_cost_logs.py`). If the primary database is unavailable, logs automatically append to `logs/openai_costs.jsonl`.
  - **Configurable Pricing**: Rates are configured dynamically via environment variables (`OPENAI_INPUT_COST_PER_M` and `OPENAI_OUTPUT_COST_PER_M`). Configured to official `gpt-6-luna` rates: **$0.10 / 1M input tokens** and **$0.50 / 1M output tokens**.
- **API Endpoints**:
  - `GET /api/costs/summary?days=7`: Returns total spend, invocation count, granular token metrics (`total_prompt_tokens`, `total_completion_tokens`), average duration/latency (`avg_duration_ms`), and per-agent cost and latency breakdown.
  - `GET /api/costs/invocations?page=1&page_size=20&agent_name=&batch_id=`: Returns paginated invocation logs with resolved human-readable `batch_name` and `school_name`, with fuzzy search support by batch name or UUID.
  - `GET /api/costs/export?days=&agent_name=&batch_id=`: Streams all matching cost log entries as a full downloadable CSV audit file (`text/csv` with `Content-Disposition: attachment`).
- **Frontend Dashboard (`/costs`)**:
  - Accessible via **AI AGENTS $\rightarrow$ Cost & Token Monitor** in the navigation rail.
  - State managed via dedicated Zustand store `useCostStore.ts`, preserving filters, pagination, and data across route navigations.
  - 4 Key KPI Cards: Total Spend (USD) with GPT-6 Luna tag, API Invocations, Tokens Consumed (with Prompt vs Completion % pill tags), and Avg Cost / Call with Latency metrics.
  - Visual horizontal progress bars displaying per-agent spend, token split, and average duration.
  - Invocations table with resolved Batch and School names and hoverable UUID tooltips.
  - Full server-side **Export Audit CSV** streaming export.
  - Execution-aware smart polling: 5-second rapid sync when agent crawling jobs are active, and 30-second passive sync when idle.

---

### 6.7. System Hardening & Code Review Enhancements
Following a comprehensive full-system code review, critical legacy routes and services were hardened for production resilience:
- **Crawl Jobs Subsystem (`/api/jobs`)**:
  - `CrawlJobModel` (`backend/app/models/pipeline.py`) was extended with nullable tracking columns (`agent_name`, `product_name`) via Alembic migration `b7c19a4e2311_add_crawl_jobs_columns_and_prompt_templates.py`.
  - Replaced legacy phantom fields with canonical table columns (`school_id`, `current_step`, `pages_crawled`, `evidence_count`, `conflict_count`, `error_message`, `created_at`, `completed_at`).
  - Added typed Pydantic v2 schemas: `JobCreateRequest`, `CrawlJobResponse`, and `JobStartResponse`.
- **Published Golden Records (`/api/published`)**:
  - Removed all synthetic hardcoded fixture values.
  - Queries genuine records from `ResolvedValueModel` where `review_status == 'approved'`, joining school metadata for authentic provenance. Returns empty list if no approved items exist.
- **Prompt Studio Engine (`/api/prompts`)**:
  - Converted in-memory list to PostgreSQL-backed `PromptTemplateModel` ORM entity with automatic initial seeding.
  - Supported runtime prompt updates and versioning via `PUT /api/prompts/{template_id}` with strict Pydantic v2 validation.
- **Concurrency & Dependency Safety**:
  - `BatchAuditProgress` in `audit.py` is protected by `threading.Lock()` across all progress state updates to eliminate multi-threaded race conditions.
  - Fixed FastAPI dependency injection in `run_batch_audit` by removing default `None` from `background_tasks: BackgroundTasks`.
- **Database Resilience**:
  - Enabled `pool_pre_ping=True` in `app/core/database.py` to auto-detect dropped connections.
  - Added explicit `except Exception: session.rollback(); raise` guard in `get_database_session()` generator.
- **Structured Error Handling & Logging**:
  - Replaced silent error swallowing in `deduplicator.py` with explicit `SQLAlchemyError` catching and structured logging.
  - Converted all raw `print(...)` statements in `planning_agent.py` and `rate_limiter.py` to `logging.getLogger(__name__)`.
- **Typed Response Contracts**:
  - Mutation endpoints across `review.py`, `sources.py`, and `health.py` return validated Pydantic models (`ReviewActionResponse`, `SourceWeightUpdateResponse`, `HealthResponse`).
  - Active `SELECT 1` database ping in `health.py` prevents false-positive health statuses.

---

### 6.8. School Management Subsystem (FR-2.1 to FR-2.4)
Located across `backend/app/api/routes/schools.py`, `backend/app/schemas/school.py`, and `frontend/src/pages/SchoolLibraryView.tsx`:
- **Functional Requirements**: Satisfies FR-2.1 (Full School Directory & Catalog), FR-2.2 (Multi-Facet Filter & Search), FR-2.3 (School Profile Inspection & Direct AI Audit), and FR-2.4 (Manual Ingestion & Multi-Batch Membership Assignment).
- **Backend Architecture & Validation**:
  - `POST /api/schools`: Manual creation backed by `SchoolCreateSchema` with Pydantic v2 validation (`model_config = ConfigDict(str_strip_whitespace=True)`). Safely provisions defaults for all 20+ non-nullable PostgreSQL boolean/timestamp columns (`is_active`, `is_tefa_approved`, `dual_language`, `before_after_care`, `transportation_provided`, `stem_program`, `open_enrollment`, `packet_available`, etc.).
  - `PATCH /api/schools/{id}`: Granular updates for name, address, phone, email, website, description, school type, grade levels, and academic tags via `SchoolUpdateSchema`.
  - `DELETE /api/schools/{id}`: Soft-deletes a school record (`deleted_at = UTC_TIMESTAMP`, `is_active = False`) and moves it to the Trash Bucket for 30-day quarantine, preserving historical references while hiding from active queries.
  - `POST /api/schools/{id}/restore`: Restores a trashed school back to active catalog.
  - `DELETE /api/schools/{id}/permanent`: Permanently deletes a school from the database, detaching relations in `batch_schools` and dependent crawler tables.
  - `GET /api/schools`: High-performance server-side paginated catalog returning `items`, `total`, `page`, `page_size`, and `total_pages`. Supports case-insensitive multi-attribute search (name, city, state), verification status tabs (`all`, `verified`, `unverified`, `pending`), classification filtering (`Public`, `Charter`, `Private`, `Magnet`), missing website filter, and sorting (`name_asc`, `name_desc`, `newest`, `oldest`).
- **Frontend Components & Modals (`frontend/src/components/schools/`)**:
  - `SchoolLibraryView.tsx`: Dedicated operations page accessed via **CORE OPERATIONS $\rightarrow$ School Management** (`/schools`):
    - 4 Top KPI Cards: Total Schools, Profile Verified %, Missing Official URL, Active Pipeline Ingested.
    - Multi-Facet Filter Toolbar: Search bar, verification status pills, type dropdown, missing website toggle, and sort selector.
    - Bulk Action Toolbar: Appears dynamically when rows are selected, showing selection count, "+ Assign to Batch" action, and clear selection button.
    - Server-side Pagination: Configurable rows per page (25, 50, 100) with responsive First/Prev/Next/Last controls.
  - `CreateSchoolModal.tsx`: Validated manual intake form for enrolling schools directly into the master registry.

---

### 6.9. Metadata Output Persistence & Scraper Content Caching
Located across `backend/app/models/metadata_output.py`, `backend/app/models/scraper_cache.py`, `backend/app/services/scraper/cache_service.py`, and `backend/app/pipelines/audit_crawler/`:
- **Architecture & Credit Conservation**:
  - **Scraped Web Content Cache (`scraped_pages_cache`)**:
    - Stores raw and pre-cleaned Markdown returned by Firecrawl or Tavily.
    - Indexed by SHA-256 URL hash (`url_hash`) with a default 14-day TTL (`expires_at`).
    - Before making outbound HTTP calls to Firecrawl, `ExtractionAgent.scrape_website` queries `ScraperCacheService.get_cached_page(url)`.
    - **Cache Hit**: Serves pre-cleaned Markdown in `< 5ms`, increments `hit_count`, and consumes **zero Firecrawl API credits**.
    - **Cache Miss**: Scrapes via Firecrawl, aggressively cleans markdown text, and automatically writes to `scraped_pages_cache` for subsequent reuse.
    - **On-Demand Cache Bypass (`force_refresh=True`)**:
      - Available via the **"Bypass Cache (Force Fresh Scrape)"** toggle in both `AgentsOperateView.tsx` (`/agents`) and `RunMetadataAgentModal.tsx`.
      - When enabled, `ExtractionAgent.scrape_website(..., force_refresh=True)` skips cache lookups and forces live Firecrawl scraping, overwriting existing records with fresh content and reset 14-day expiration timestamps.
  - **Dedicated Agent Output Table (`metadata_agent_outputs`)**:
    - Persists every execution run of the School Profile & Metadata Agent (`overall_score`, `verification_status`, `extracted_fields` JSONB, `recommendations` JSONB, `pages_crawled_count`, `applied_to_school`).
    - Retains an immutable audit trail without losing historical extractions when canonical school records are updated.
  - **Granular Field Citations (`evidence_records`)**:
    - Stores field-by-field proof (`phone`, `email`, `address`, `grades`) linking directly to `metadata_output_id`, the source webpage URL, verbatim markdown snippets (`raw_extracted_text`), and model confidence scores.
  - Applied via Alembic migration `2b5010c3b19c_add_metadata_output_and_scraper_cache.py`.

---

### 6.10. Human-in-the-Loop (HITL) Verification & Review Queue (FR-9.1 to FR-9.6)
Located across `backend/app/api/routes/review.py`, `backend/app/schemas/review.py`, and `frontend/src/pages/ReviewQueueView.tsx`:
- **Minimalist School-Centric Architecture**:
  - **School-Grouped Queue (Left Panel)**:
    - Instead of showing individual duplicate cards for every field, review records are grouped by unique `school_id`.
    - Each card displays the school name, campus address preview, pending fields badge (e.g. `9 fields to verify`), and average confidence score.
  - **Review Workspace & Field Matrix (Right Panel)**:
    - **Header Banner**: School name, clickable official website link, and a 1-click **[✔ Approve Entire School Profile]** hero action.
    - **1-Click Batch Approval**: `POST /api/review/{output_id}/approve` accepts the output ID without field qualifiers to approve and apply all recommendations in a single transaction, marking the school `verified` and updating batch progress.
    - **High-Density Field Matrix**: Clean comparison table displaying Field, Current Database Value, AI Extracted Value, Confidence Score, Verbatim Proof toggle, and Row Actions.
    - **Verbatim Evidence Preview**: Expandable callout showing the exact quotation Firecrawl scraped from the website with direct citation links.
    - **Inline Quick Edits**: Operators can edit any field directly within the table row using an inline text input with Enter-to-save (`POST /api/review/{output_id}:{field_name}/correct`).
  - **Decision Routing Bands**:
    - $\ge 95\%$: Auto Publish
    - $85 - 94\%$: Reviewer Approval
    - $70 - 84\%$: Mandatory HITL Review
    - $< 70\%$: Escalation Required
  - **Operator Decision Actions**:
    - `POST /api/review/{output_id}/approve` / `POST /api/review/{output_id}:{field_name}/approve`:
      - Applies the verified recommendation directly into the master `schools` table.
      - Sets `school.profile_verification_status = 'verified'` and `school.is_active = True`.
      - Updates `batch_schools.status = 'verified'` and cascades batch progress metrics.
    - `POST /api/review/{output_id}:{field_name}/correct`:
      - Accepts manual operator overrides (`ReviewCorrectRequest`), updates `schools`, and marks verified.
    - `POST /api/review/{output_id}:{field_name}/reject`:
      - Dismisses recommendation while preserving full historical audit logs.
  - **Batch & Product Partitioned School Review (`GET /api/review/schools`)**:
    - Query parameters: `batch_id`, `product` (e.g. `'info'`), `queue_type` (`'verification'` | `'approved'` | `'recrawl'`), and `search`.
    - Returns `list[VerificationSchoolItem]` complete with DQA score, average confidence %, extracted contact details, recommendations, evidence citations, `is_published` flag, and `production_school_id`.
    - When `queue_type == 'approved'`, queries strictly pending `"approved"` records from `staging_schools`, automatically excluding published records once they are promoted to the master `schools` catalog.
  - **Unified Multi-Scope Review Actions (`POST /api/review/bulk-action`)**:
    - Accepts `BulkReviewActionRequest` with `scope` (`'single'` | `'group'` | `'batch'`) and `action` (`'approve'` | `'reject'` | `'undo'` | `'publish'`).
    - **`approve`**: Marks school `verified`, applies recommended attributes, and routes to **Approved Schools** (`/approved`).
    - **`reject`**: Marks school `rejected` and routes to **Re-crawl Queue** (`/recrawl`).
    - **`undo`**: Reverts school to `needs_verification` and immediately returns it to the **Verification Queue** (`/review`).
    - **`publish`**: Promotes verified records from `staging_schools` into the master production `schools` table via `SchoolPromotionService`. It updates `staging_schools.status = 'published'`, writes or updates the golden record in `schools`, sets `production_school_id`, repoints citations/outputs, and makes the school immediately visible in School Management (`/schools`).
  - **Approved Schools & Production Promotion UI (`/approved`)**:
    - High-density table displaying status badges (`"Verified"` vs `"Published"`), crawled contact details, citations count, and DQA audit scores.
    - **Row Actions**: `[Inspect]` (opens slide drawer), `[ 🚀 Publish ]` (triggers confirmation modal for single-school promotion), and `[Undo]` (reverts to Verification Queue).
    - **Batch Actions**: `[ 🚀 Publish Approved Batch ]` in header and `[ 🚀 Publish Selected ]` in multi-select action bar.
    - **Safety Confirmation**: Double-confirmation dialog preventing accidental bulk promotions to the master database catalog.
    - **Evidence Drawer**: Slide-out drawer with dedicated `[ 🚀 Publish to Production Schools ]` footer button.
  - **Re-crawl Execution Engine**:
    - Operators can dispatch single-school or batch-wide crawler re-executions directly from the **Re-crawl Queue** using `POST /api/agents/run-for-batch` (`force_refresh=True`).
    - On crawl completion, the school re-enters the Verification Queue for human validation.

---

### 6.11. Pipeline Runs History & Multi-Format Export Engine (HTML, Excel, CSV)
Located across `backend/app/api/routes/runs.py`, `backend/app/services/reporting/`, `frontend/src/pages/BatchRunsListView.tsx`, and `frontend/src/pages/BatchRunDetailView.tsx`:
- **Execution Run Auditing & History**:
  - `GET /api/runs`: Lists aggregated historical batch pipeline executions (`job_id`, `batch_name`, `created_at`, `total_schools`, `verified_count`, `needs_review_count`, `avg_score`, `cache_hits_total`).
  - `GET /api/runs/{job_id}`: Returns complete execution outcome with all schools and their extracted profiles (`name`, `phone`, `email`, `website`, `address`, `grades`, `description`, `open_enrollment`, etc.).
- **Multi-Format Export Engine**:
  - **Standalone HTML Report (`GET /api/runs/{job_id}/export/html`)**:
    - Generates a self-contained responsive HTML document styled with embedded CSS.
    - Features executive KPI summary cards, verified vs needs review ratios, and school cards with extracted attributes.
    - Zero external CDN dependencies — safe for corporate email attachments and offline distribution.
  - **Excel Workbook (`GET /api/runs/{job_id}/export/excel`)**:
    - Formatted `.xlsx` file generated via `openpyxl`.
    - Features Deep Navy `#0A1F3C` headers, auto-adjusted column widths, and status-based conditional coloring.
  - **CSV Stream (`GET /api/runs/{job_id}/export/csv`)**:
    - RFC 4180 standard comma-separated stream for data engineering pipelines.
- **Frontend Views**:
  - **Pipeline Runs List (`/runs`)**: Dedicated page in **AI AGENTS** sidebar with search, metrics, verification split progress bars, and 1-click export actions.
  - **Batch Run Detail View (`/runs/:jobId`)**: Detailed school-by-school output inspector with search, verification filter tabs, and prominent export toolbar (`[Download HTML Report]`, `[Export Excel]`, `[CSV]`).

---

### 6.12. Frontend State Management & Centralized API Architecture (Zustand + Axios)
Located across `frontend/src/services/` and `frontend/src/stores/`:
- **Centralized Axios Client (`frontend/src/services/client.ts`)**:
  - `apiClient`: Pre-configured Axios instance with `baseURL = VITE_API_BASE_URL` (default `http://localhost:8001/api`), 30-second timeout, and JSON headers.
  - **Request Interceptor**: Transparently attaches Bearer authentication tokens from `localStorage.getItem('auth_token')`.
  - **Response Interceptor & Error Normalization**: Transforms Axios errors into strongly typed `ApiError` instances via `formatApiError()`. Automatically parses FastAPI / Pydantic v2 `422 Unprocessable Entity` error arrays (`err.loc` and `err.msg`) into human-readable strings.
- **Typed Service Layer (`frontend/src/services/api.ts`)**:
  - Strongly typed API methods wrapping all FastAPI backend endpoints.
  - Delegates DOM-level file downloads (`saveBlobAsFile`) to `frontend/src/utils/download.ts` in adherence to Single Responsibility Principle (SRP).
- **Domain-Driven Zustand Stores (`frontend/src/stores/`)**:
  - `useBatchStore`: Operational batch catalog, detail inspection, optimistic add/drop school mutations, search/status filtering with race-condition prevention.
  - `useSchoolStore`: Master School Library catalog, multi-facet filtering, server-side pagination, bulk active toggles via `Promise.allSettled`.
  - `useAgentStore`: AI agent registry, multi-batch run dispatch, job polling with error state capture.
  - `useReviewStore`: ERCIE HITL decision console, single-field approvals/rejections/corrections, and whole-school profile verification.
  - `useTrashStore`: Global 30-day Trash Bucket, retention countdown, restore, permanent purge, expired batch cleanups.
  - `useGovernanceStore`: Dynamic source authority weights, golden published records, Prompt Studio templates.
  - `useBatchRunStore`: Historical pipeline runs, summary KPIs, school breakdown, export downloads.
  - `useAppStore`: Global application shell, RBAC role switcher (`Admin`, `Reviewer`, `Viewer`), toast notification queue with managed auto-dismiss timers, Copilot drawer state.
- **Senior Zustand Engineering Standards**:
  - **Atomic Selectors & `useShallow`**: View components never subscribe to the entire store. Multi-value selections use `useShallow` from `zustand/react/shallow` to eliminate unnecessary re-renders.
  - **Curried `create<State>()(...)` Syntax**: Strict generic TypeScript inference across all stores.
  - **First-Class `reset()` Actions**: Every store exports an `initialState` constant and a `reset: () => set(initialState)` action for unmounting and test isolation.
  - **Race Condition Prevention**: Asynchronous search operations use request sequence counters to discard stale out-of-order responses.

### 6.13. Staging Schools Isolation & Results View Engine

#### Architecture & Isolation Principles
1. **Golden Record Production Table (`schools`)**:
   - The production `schools` table is strictly protected as an authoritative repository for verified, validated, and approved school profiles.
   - Raw intake batches, tentative CSV imports, and unverified crawler iterations **never** touch the `schools` table directly.
2. **Intake Staging Table (`staging_schools`)**:
   - `StagingSchoolModel` stores raw batch school intake data (`source_data`), staging status (`pending`, `crawling`, `needs_verification`, `verified`, `published`), and multi-agent crawl product progress (`metadata_json`).
   - Alembic migration `3d8f1e2a9b4c` created `staging_schools` with cascading foreign keys to `batches` and nullable foreign keys to `schools`.
   - Migration `4e9a2b1c8f3d` added `staging_school_id` foreign keys to `metadata_agent_outputs` and `evidence_records`.
3. **Controlled Promotion Service (`SchoolPromotionService`)**:
   - Located at `backend/app/services/promotion/school_promotion_service.py`.
   - Promotes a verified staging record into the production `schools` table, binding `production_school_id`, setting status to `published`, and linking all historical evidence and agent outputs.
4. **Results View UI & Dropdown Filtering (`/results`)**:
   - Replaced legacy batch pipeline runs list with a record-by-record table view matching the user prototype.
   - **Batch Dropdown**: "All batches" + dynamic batch selectors.
   - **Product Dropdown**: "Open Seats & Capacity", "School Profile & Metadata", "Tuition & Financials", etc.
   - **Dynamic Columns**: Displays `VALUE 1`, `VALUE 2`, `VALUE 3` tailored to the selected product (e.g. Grade band, Open seats, Waitlist size).
   - **Interactive Drawer**: Clicking any row reveals DQA scores, full extracted attributes, recommendations with citations, and a 1-click **Promote to Production** action.
   - **Multi-Format Exports**: Includes `/api/results/export/excel`, `/api/results/export/csv`, and `/api/results/export/html`.

---

### 6.14. Parallel Worker Concurrency & Interactive Job Controls (Pause, Resume, Cancel)
Located across `backend/app/api/routes/agents.py`, `backend/app/api/routes/batches.py`, `backend/app/pipelines/audit_crawler/rate_limiter.py`, and `frontend/src/pages/AgentsOperateView.tsx`:

- **Parallel Worker Concurrency (`ThreadPoolExecutor`)**:
  - Operators can select between **1 to 5 parallel worker threads** (default: 2) when launching or resuming batch crawler jobs.
  - Concurrency is managed via `concurrent.futures.ThreadPoolExecutor(max_workers=concurrency)`.
  - Each thread acquires its own isolated database session (`get_database_session()`) to prevent cross-thread session corruption.
- **Thread-Safe Global Rate Limiting**:
  - `ApiRateLimiter` enforces strict cooldown intervals (6.0s for Firecrawl, 1.5s for Tavily) using a Python `threading.Lock()`.
  - Regardless of worker count (1 to 5), concurrent worker threads queue safely behind the lock, guaranteeing that outbound Firecrawl API requests remain strictly spaced by at least 6.0 seconds.
- **Smart-Skip Protection for Verified Schools**:
  - When running or resuming batch crawl jobs (`POST /api/agents/run-for-batch` or `POST /api/batches/{id}/run-metadata-agent`), schools that have already been audited and marked `verified` or `needs_verification` are automatically skipped unless the operator explicitly sets `force_refresh=True`.
  - This protects already completed schools in a batch from being unnecessarily re-audited and saves API credits.
- **Interactive Job Control Endpoints**:
  - `POST /api/agents/jobs/{job_id}/pause`: Safely pauses execution. Active in-flight worker school extractions finish gracefully, and the job status transitions to `Paused` (and batch status to `paused`).
  - `POST /api/agents/jobs/{job_id}/resume?workers={N}`: Resumes an existing paused, failed, or cancelled job. Automatically selects all remaining unverified schools and launches workers with the requested concurrency.
  - `POST /api/agents/jobs/{job_id}/cancel`: Immediately halts further queue consumption, sets job status to `Cancelled`, and resets any partially crawling staging schools back to `pending`.
- **Frontend Interactive Controls**:
  - **Agents Operate View (`/agents/operate`)**:
    - **Workers Selector**: Dropdown selector in the Section 2 Action Bar with options 1 through 5.
    - **Live Execution Monitor**: Displays dynamic status badges (`Running`, `Paused`, `Cancelled`, `Completed`, `Failed`) with live action buttons (`[Pause]`, `[Resume (Nw)]`, `[Cancel]`).
  - **Crawl Job Monitor (`/jobs`)**:
    - Real-time row action buttons for Pause, Resume, and Cancel, with auto-polling every 3 seconds for active jobs.
  - **Batch Detail View (`/batches/:id`)**:
    - When a batch is paused, displays an informative amber banner with a 1-click **[Resume in Monitor]** button.
  - **Run Metadata Agent Modal**:
    - Configurable Parallel Workers dropdown selector (1 to 5 workers) alongside queue priority and scraper cache bypass.

---

### 6.15. UI Usability Standards & Explicit Action Button Labels
To maintain high operator confidence and prevent accidental triggers during data reviews:
- **Zero Icon-Only Mutation Buttons**: All table row action buttons, navigation controls, and queue operation buttons must include visible, intention-revealing text labels alongside standard Lucide icons:
  - **Verification Queue (`/review`)**: `[👁 Inspect]`, `[✕ Reject]`, `[✔ Approve]`, `[↻ Refresh]`.
  - **Approved Schools (`/approved`)**: `[👁 Inspect]`, `[↩ Undo]`, `[↻ Refresh]`.
  - **Re-crawl Queue (`/recrawl`)**: `[👁 Inspect]`, `[↩ Undo]`, `[↻ Re-crawl]`, `[↻ Refresh]`.
  - **School Management (`/schools`)**: `[👁 View]`, `[✎ Edit]`, `[✨ Audit]`, `[Deactivate/Activate]`, `[🗑 Delete]`, `[‹ Prev]`, `[Next ›]`.
  - **Batch Navigation (`/batches/:id`, `/batches/create`)**: `[← Back to Batches]`, `[Drop]`.
  - **Batch Runs List (`/runs`)**: `[👁 Inspect]`, `[📄 HTML]`, `[📊 Excel]`, `[⤓ CSV]`.
  - **Cost Monitor (`/costs`)**: `[‹ Prev]`, `[Next ›]`.
- **Persistent Visibility**: Avoid hiding button text behind responsive utility classes (such as `hidden sm:inline` or `hidden lg:inline`) on primary actions like `Edit`, `Delete`, and `Drop`.
- **Accessible Dialog Headers**: Modal and drawer close buttons must carry `aria-label="Close"` and `title="Close"` attributes.

---

### 6.16. AWS RDS Sandbox Publishing Synchronization (`sdn_prod_sandbox`)

To bridge verified data intake with downstream testing environments, SchoolPath features a fail-safe dual-database publishing workflow:
1. **Primary Master Promotion**: When an operator publishes an approved school from `/approved` (`POST /api/review/bulk-action` with `action="publish"`), the staging record is promoted locally to the master Supabase database (`Schools` table).
2. **AWS RDS Sandbox Synchronization (`sdn_prod_sandbox`)**: Simultaneously, if `SANDBOX_ENABLED=true` in `backend/.env`, the system extracts verified core attributes and synchronizes them directly into `public.schools` on AWS RDS PostgreSQL.

#### A. Active vs. Ignored Column Boundaries
To avoid overwriting specialized curriculum or enrollment rubrics, the Sandbox synchronization enforces strict column scoping:
- **Active Core Columns (Updated/Inserted in Sandbox)**:
  - `name`: Cleaned, non-empty school name.
  - `website`: Canonical school website URL.
  - `address`: Verified physical street address.
  - `phone`: Cleaned phone number (trailing `.0` numeric artifacts automatically stripped).
  - `email`: Contact / admissions email.
  - `type`: JSONB array of school classifications (e.g. `["private"]`).
  - `grades`: JSONB array of grade levels offered (e.g. `["K", "1", "2"]`).
  - `description`: School mission statement or verified description.
  - `is_active`: Set to `true` upon publication.
  - `updated_at`: Set to current timestamp (`now()`).
  - `id` / `created_at`: Native UUID / timestamp set on insert.
- **Strictly Ignored Columns (Untouched in Sandbox)**:
  - ❌ `learning_models`: Preserved as-is in Sandbox.
  - ❌ `extracurricular_programs`: Preserved as-is in Sandbox.
  - ❌ `open_enrollment`: Preserved as-is in Sandbox.
  - ❌ `full_address`: Preserved as-is in Sandbox (only `address` is updated).

#### B. Connection Management & Query Safety
- **Pooled Singleton Engine**: Managed via `app/services/sandbox_sync/sandbox_client.py` using SQLAlchemy (`pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`).
- **Statement Timeout**: Automatically sets `-c statement_timeout=5000` (5 seconds) to prevent hung queries or database locks.
- **Fail-Safe Isolation**: A network interruption to AWS RDS Sandbox will **never roll back** local Supabase promotion. If Sandbox is unreachable, Supabase commits safely, the failure is caught, and the error is persisted to `staging.metadata_json["sandbox_sync"] = {"status": "failed", "error": "..."}`.

#### C. Manual Retry Endpoint & UI Controls
- **Endpoint**: `POST /api/review/schools/{id}/retry-sandbox-sync` (returns `SandboxSyncStatusResponse`).
- **UI Visibility**:
  - **Approved Schools (`/approved`)**: Status column displays `● Sandbox Synced` or `● Sandbox Failed`.
  - **Published Golden Datasets (`/published`)**: Dedicated **Sandbox Sync** column displaying green `Sandbox Synced` pill (hover reveals Sandbox UUID) or red `Sandbox Failed` pill alongside a 1-click **`[ ↺ Retry Sandbox Sync ]`** button.
- **Zero Agent Mutations**: As an absolute safety guarantee, all writes to AWS RDS Sandbox are initiated strictly by human operators clicking "Publish" or "Retry Sandbox Sync" in the frontend.

---

## 7. Critical Operational & Database Safety Rules

When working on this repository, you **must adhere to the safety rules in `AGENTS.md`**:
1. **Remote/QA/Prod Databases**:
   - Treat all remote databases as sensitive live environments.
   - **Strictly READ-ONLY**: NEVER execute `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, or `TRUNCATE` outside of reviewed migration scripts.
   - Always set query timeouts (`statement_timeout = '5000'`).
   - Never run unindexed full-table scans or unbounded `COUNT(*)` without `LIMIT` or catalog table stats (`pg_stat_user_tables`).
2. **Clean Code & Architecture**:
   - Adhere to Clean Architecture, SOLID principles, and human-readable, intention-revealing naming.
   - Keep business logic in `services/` or `pipelines/`, API controllers in `api/routes/`, and persistence in `models/`.
3. **Secrets Management & Zero-Hardcoding**:
   - **Never hardcode secrets**: API keys, tokens, or database connection strings with credentials must NEVER be placed in code, scripts, or git commits.
   - **Environment variables only**: Always load credentials through `.env` files locally or environment variables in production.
   - **Git protection**: Ensure all `.env` files remain ignored in `.gitignore`, and keep `.env.example` updated with safe templates.
   - **Mask logs**: Never output raw passwords, bearer tokens, or sensitive URLs in console logs or error messages.
4. **Input Validation & Pydantic Standards (Skill: `pydantic-validation`)**:
   - **Zero Raw Dicts**: Never accept raw `dict` or untyped `Body(...)` in FastAPI route handlers.
   - **Whitespace Stripping**: Every request model must define `model_config = ConfigDict(str_strip_whitespace=True)`.
   - **Explicit Bounds & Types**: Use `min_length`, `max_length`, `ge`, `le`, and `Literal[...]` enums.
   - **Cross-Field Validation**: Enforce dependent fields using `@model_validator(mode="after")`.
5. **Explicit Imports & Clean Organization**:
   - **Explicit Imports**: Every file must explicitly import the modules, functions, and classes it directly needs. Never use wildcard imports (`from module import *`).
   - **Clean Organization**: Keep import statements transparent so that code dependencies are obvious at a glance. Maintain clear grouping (Standard library $\rightarrow$ Third-party $\rightarrow$ Internal modules) and automatically prune dead imports via `uv run ruff check app` and `pnpm lint`.

---

## 8. Common Troubleshooting & FAQ

### Q1: `uv: command not found`
Ensure `~/.cargo/bin` is in your shell `PATH`:
```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
```

### Q2: Port 8001 or 5173 already in use
Check what process is occupying the port and stop it or configure an alternate port:
```bash
# Check port occupancy
ss -tulpn | grep 8001
# Or run backend on an alternate port
uv run uvicorn app.main:app --reload --port 8002
```
If you change the backend port to `8002`, remember to update `VITE_API_BASE_URL=http://localhost:8002/api` in `frontend/.env`.

### Q3: `TypeError: schools.map is not a function` in Frontend
If you modify endpoints or pagination schemas, ensure `frontend/src/services/api.ts` always unwraps paginated envelopes (`data.items || []`).

### Q4: Cross-Platform (Windows vs Ubuntu/Linux)
- The project is fully compatible with both Ubuntu and Windows.
- Always use forward slashes (`/`) in import paths and URL strings.
- Linux file systems are case-sensitive. Ensure file import casings match the file names exactly.

### Q5: Agent Execution Monitor Progress & Staging Schools
When batches of schools are processed, schools are held in `staging_schools` (`StagingSchoolModel`). The real-time job execution monitor endpoint (`GET /api/agents/jobs`) queries `StagingSchoolModel` (where `deleted_at IS NULL`) to compute aggregate progress (`target_count`, `completed_count`, `status`), recognizing `"verified"`, `"needs_review"`, and `"needs_verification"` statuses from metadata agent runs.

### Q6: Verification Queue (`/review`) & Staging Schools
Audit outputs generated during batch execution link to `staging_school_id` (`staging_schools`). The Verification Queue endpoints (`GET /review`, `POST /review/{id}/approve`, `POST /review/{id}/correct`) resolve against `StagingSchoolModel` when `o.school_id` is null, query citations via `EvidenceRecordModel.staging_school_id`, and update the staging record's status to `verified` upon reviewer approval.

### Q7: Results vs. Verification Queue Run Synchronization
To prevent duplicate recommendations across re-runs, the audit crawler automatically supersedes prior unapplied outputs when a new run is executed. The `/review` endpoint deduplicates by unique school entity, only serving the latest run's recommendations and propagating the audit crawler's overall `dqa_score` alongside average field extraction confidence.

### Q8: Batch Intake Attribute Preservation & Grades Resolution Hierarchy
When batches are uploaded via CSV or Excel:
1. Contact & classification columns (`phone`, `email`, `type`, `grades`) are automatically parsed and normalized (supporting both native JSON strings and comma-delimited lists) during preview and confirmation.
2. Initial staging records (`StagingSchoolModel`) and `source_data["original_grades"]` preserve these values.
3. During audit crawling, `validate_school` follows a 4-tier Grades Resolution Hierarchy:
   - **Tier 1 (Formal Grades)**: Direct extraction of explicit grades from page text.
   - **Tier 2 (Named Programs)**: Program/classroom names (Infant, Toddler, Preschool, Pre-K 3, Pre-K 4, Kindergarten).
   - **Tier 3 (Age Criteria)**: Derivation from stated age/month criteria.
   - **Tier 4 (School Level Inference & Rule 2 Preservation)**: Standard grade bands based on verified school classification (Elementary $\rightarrow$ K–5, Middle $\rightarrow$ 6–8, High $\rightarrow$ 9–12) or preservation of verified database/intake grades under Rule 2 if the site lacks explicit grade listings.

---

*Document version: 1.4.0 • Maintained by SchoolPath Engineering Team*
