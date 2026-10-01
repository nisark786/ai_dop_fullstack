# SchoolPath AI-DOP — Development Task Breakdown & Progress Tracker

This document tracks all implementation tasks from start to finish. Each task is granular, testable, and mapped to the system specification.

---

## 📊 Milestone Roadmap Overview

- [x] **Milestone 1: Batch Intake & Management (FR-3.1 to FR-3.6)**
- [x] **Milestone 2: School Library Selection & Multi-Batch Membership (FR-2.1 to FR-2.4)**
- [ ] **Milestone 3: Data Product & Agent Registry (10 Agents Integration) (FR-4.1 to FR-4.5)**
- [ ] **Milestone 4: Agent Execution & Job Dispatch Engine (FR-5.1 to FR-5.6)**
- [x] **Milestone 5: Human-in-the-Loop (HITL) Verification & Review Queue (FR-9.1 to FR-9.6)**
- [ ] **Milestone 6: Production Publishing & SchoolPath Sandbox Sync (FR-10.1 to FR-11.4)**
- [ ] **Milestone 7: Source Authority & Input Registry (ERCIE Learning)**
- [ ] **Milestone 8: Authentication & Role-Based Access Control (RBAC - JWT) (FR-1.1 to FR-1.3)** 👈 *MOVED TO LAST*

---

## Milestone 1: Batch Intake & Management (FR-3.1 to FR-3.6)

### 🎯 Objective
Implement complete end-to-end Batch Intake & Management per Phase 1 FRD Section 5.3 (`FR-3.1` to `FR-3.6`), Section 7 (Logical Data Model), Section 9 (UI Requirements), and Section 10 (API Surface). Operators can create named batches, import schools via Excel/CSV with validation and duplicate prevention, manage batch lifecycle, and view batch-level product progress.

### 📋 Detailed Sub-Tasks:

- [x] **Task 1.1: Database Schema & SQLAlchemy Models for Batches (`batches` & `batch_schools`)**
  - Created tables `batches` and `batch_schools` with PostgreSQL and SQLite interoperability.
  - Added indexed `deleted_at: DateTime` column via Alembic migration (`add_deleted_at_to_batches`) to support soft-deletion and 30-day Trash retention.

- [x] **Task 1.2: Excel / CSV Parser & Duplicate Detection Engine**
  - Implemented service in `app/services/batch_importer.py`:
    - Strict validation: Name + (Address or Website) required.
    - Identity matching against database schools (exact domain and fuzzy name).
    - Validation preview and duplicate resolution selectors.

- [x] **Task 1.3: Batch REST API Endpoints**
  - `GET /api/batches`: List active batches (filters out soft-deleted items by default).
  - `GET /api/batches/trash`: List quarantined batches in Trash Bucket with `days_remaining`.
  - `POST /api/batches/upload-preview`: Validates uploaded files.
  - `POST /api/batches/upload-confirm`: Commits batch and schools to database.
  - `GET /api/batches/{id}`: Detailed batch inspection and school membership.
  - `PATCH /api/batches/{id}`: Update batch name and description.
  - `DELETE /api/batches/{id}`: Soft-delete batch into 30-day Trash Bucket.
  - `POST /api/batches/{id}/restore`: Restores soft-deleted batch.
  - `DELETE /api/batches/{id}/permanent`: Irreversibly purges batch and cascading relations.

- [x] **Task 1.4: Frontend Batch Management & Intake UI**
  - Clean Prototype Design System matching Deep Navy (`#0A1F3C`) sidebar rail and 66px top header.
  - `BatchListView`:
    - Replaced `[Open] [Duplicate] [Archive]` with `[Open]`, `[Edit]`, and `[Delete]`.
    - Edit Modal for changing Batch Name and Description.
    - Soft-delete confirmation modal with warning explaining 30-day retention policy.
    - Dedicated `Trash` tab with badge count, retention status (`days_remaining`), and one-click `Restore` action.
  - Dedicated `/batches/create` 3-card progressive intake flow.
  - Dedicated `/batches/:id` batch detail view with dynamic stats.

- [x] **Task 1.5: End-to-End Verification & Automated Linting**
  - Backend: `uv run ruff check app` (0 errors) and `uv run ruff format app`.
  - Frontend: `pnpm tsc -b` (0 errors) and `pnpm lint` (0 errors).
  - Verified soft deletion, trash quarantine, retention calculation, and restoration flows.

- [x] **Task 1.6: Batch School Membership Controls (Manual Add & Drop School)**
  - Backend: Added `POST /api/batches/{id}/schools` and `DELETE /api/batches/{id}/schools/{school_id}` in `batches.py` and `BatchService`.
  - Frontend `BatchListView`: Enhanced Edit Modal with dedicated "Manage Schools" tab allowing live search & link from master library or new manual creation, plus instant "Drop" action.
  - Frontend `BatchDetailView`: Added "+ Add School" modal and individual "Drop" action button per school row.

- [x] **Task 1.7: Automated 30-Day Trash Background Purge Worker**
  - Backend: Integrated background maintenance worker into FastAPI `lifespan` handler in `app/main.py`.
  - Automatically sweeps and purges batches where `deleted_at > 30 days` every 24 hours and on system startup.
  - Added administrative on-demand endpoint `POST /api/batches/trash/purge-expired`.

- [x] **Task 1.8: Clean Architecture Refactoring & File Decomposition (SRP Enforcement)**
  - Decomposed 650-line backend `batch_importer.py` into dedicated package `backend/app/services/batches/` (`file_parser.py`, `deduplicator.py`, `school_factory.py`, `template_service.py`, `batch_service.py`), completely removing `batch_importer.py` and using `app.services.batches` directly throughout the application.
  - Decomposed 720-line frontend `BatchListView.tsx` into modular components under `frontend/src/components/batches/` (`BatchKpiCards.tsx`, `ActiveBatchesTable.tsx`, `TrashBatchesTable.tsx`, `EditBatchModal.tsx`, `DeleteBatchModal.tsx`), reducing `BatchListView.tsx` to a clean ~170-line coordinator.

- [x] **Task 1.9: Global Trash Bucket Decoupling & Batch Detail Streamlining**
  - Decoupled Trash Bucket into dedicated global section (`/trash` & `TrashBucketView.tsx`) accessible via the main sidebar under Core Operations.
  - Removed Trash tab, filter badges, and purge buttons from `BatchListView.tsx` so Batch Management strictly manages active operational batches.
  - Streamlined `BatchDetailView.tsx` by removing "Run Metadata Agent" button, bulk agent dispatch modal, school-level audit play button, and the `MetadataAuditDrawer`, refocusing Batch Management purely on batch membership and school intake operations.
  - Zero breaking changes, verified with `uv run ruff check app` (0 errors) and `pnpm tsc -b` (0 errors).

- [x] **Task 1.9: Enterprise Pydantic v2 Input Validation & Workspace Skill (`pydantic-validation`)**
  - Created `.agents/skills/pydantic-validation/SKILL.md` and added **Rule 6: Input Validation & Pydantic Standards** in `AGENTS.md`.
  - Upgraded all backend Pydantic schemas (`batch.py`, `school.py`) with `str_strip_whitespace=True`, string bounds, numeric bounds (`0.0 <= weight <= 100.0`), `Literal[...]` enum types, and `@model_validator(mode="after")` cross-field integrity checks.
  - Replaced raw `dict` / `Body(...)` inputs in `sources.py`, `review.py`, and `jobs.py` with dedicated Pydantic request models (`SourceWeightUpdateRequest`, `ReviewCorrectRequest`, `JobCreateRequest`).
  - Verified with 16 automated boundary/edge-case tests, `uv run ruff check app` (0 errors), and `pnpm tsc -b` (0 errors).


---

- [ ] **Task 1.1: Database Schema Alignment for `source_registries`**
  - Table: `source_registries`
  - Columns:
    - `id` (VARCHAR(50), PK, e.g. `src-official-portal`, `src-greatschools`)
    - `source_name` (VARCHAR(100), e.g. "Official School Website")
    - `domain_pattern` (VARCHAR(255), e.g. `*`, `greatschools.org`, `niche.com`, `tea.texas.gov`)
    - `category` (VARCHAR(50), e.g. "Category 1 — Official School", "Category 2 — Official Social", "Category 3 — External")
    - `configured_weight` (FLOAT, default 100.0 / 75.0 / 40.0)
    - `effective_weight` (FLOAT, dynamically calculated)
    - `approved_count` (INTEGER, default 0)
    - `corrected_count` (INTEGER, default 0)
    - `rejected_count` (INTEGER, default 0)
    - `total_reviews` (INTEGER, default 0)
    - `historical_accuracy` (FLOAT, default 100.0)
    - `is_active` (BOOLEAN, default True)
    - `created_at`, `updated_at` (TIMESTAMP)

- [ ] **Task 1.2: SQLAlchemy ORM Model & Pydantic Schemas**
  - Update `backend/app/models/source.py` / `pipeline.py` with exact columns matching Spec Section 5.7, 14, 15, and 20.1.
  - Create request/response Pydantic schemas in `backend/app/schemas/source.py`.

- [ ] **Task 1.3: Seed Authoritative Base Sources**
  - Seed Category 1: Official School Portals (Default weight: 100)
  - Seed Category 2: Verified District / Social Portals (Default weight: 75)
  - Seed Category 3: External Directories & Aggregators (GreatSchools, Niche, TEA, NCES) (Default weight: 40)

- [ ] **Task 1.4: Source Classification Helper Utility**
  - Create `app/services/source_classifier.py` that takes any URL (e.g. `https://www.antonian.org/admissions`) and matches it against the school's official domain and known registries to return its category and trust weight.

- [ ] **Task 1.5: REST API Endpoints & Verification**
  - Verify `GET /api/sources` returns all sources with live weights.
  - Verify `PATCH /api/sources/{id}/weight` allows Admin to tune baseline weights.
  - Verify `uv run ruff check app` and `uv run ruff format app` pass with 0 errors.
  - Verify frontend `/ranking` view displays the live database sources.

---

## Milestone 2: School Input Feeder & Agent Crawler Pipeline

- [x] **Task 2.1: School Profile & Metadata Agent (gpt-6-luna + Firecrawl + Tavily)**
  - Configured `OPENAI_MODEL=gpt-6-luna` across backend `.env`, `.env.example`, and application settings.
  - Implemented thread-safe `ApiRateLimiter` (Firecrawl: 6.0s spacing, Tavily: 1.5s spacing) and `KeyRotator` in `rate_limiter.py`.
  - Added ISD District & Campus subpage resolver in `planning_agent.py` (`is_district_portal`, `find_campus_in_isd_directory`).
  - Implemented 9-rule extraction engine in `extraction_agent.py` (Identity check, 3-tier grade hierarchy, Age $\neq$ Grade, enum normalization).
  - Added `SchemaKnowledgeBase` with canonical allowed values and DQA reporting in `audit_service.py`.
- [x] **Task 2.2: Batch Metadata Agent Dispatch & Background Worker**
  - Added `POST /api/batches/{id}/run-metadata-agent` backed by `RunMetadataAgentRequest` and `AgentDispatchResponse`.
  - Background worker updates `batch_schools.metadata_json["products"]["info"]` and registers `CrawlJobModel`.
- [x] **Task 2.3: Frontend UI for Metadata Agent & Inspection Drawer**
  - Created `RunMetadataAgentModal.tsx` for dispatching agent across Single, Group, or Whole Batch.
  - Created `MetadataAuditDrawer.tsx` for inspecting overall quality score, field diffs, confidence, reasons, and verbatim quotes.
  - Updated `BatchDetailView.tsx` with `School Info (Metadata)` primary product column, status chips (`Not Run`, `Queued`, `Running...`, `Verified`, `Needs Review`), and 3-second live polling.
- [x] **Task 2.4: AI Agents Operations Control Plane (FR-4, FR-5, FR-7)**
  - Config-driven dynamic agent catalog serving 10 data product agents (`GET /api/agents/registry`) with active `gpt-6-luna` engine for Metadata Agent and locked `coming_soon` state for future agents (zero frontend hardcoding).
  - Batch multi-agent execution orchestrator (`POST /api/agents/run-for-batch`) supporting scope (`batch`, `group`, `single`) and priority (`normal`, `high`, `low`).
  - Real-time job monitoring endpoint (`GET /api/agents/jobs`) computing live school completion progress from batch membership records.
  - Built `AgentsOperateView.tsx` with target batch selector dropdown, priority switcher, agent cards selection grid, and live execution monitor with progress bar and 3-second polling.
  - Added dedicated `AI AGENTS` section in `Sidebar.tsx` pointing to `/agents`.
- [x] **Task 2.5: Global OpenAI Cost Logger & Token Monitor Dashboard**
  - Implemented `CostTrackingOpenAIClient` wrapper around `OpenAI` client, intercepting structured outputs (`beta.chat.completions.parse`) and completions (`chat.completions.create`) to capture prompt, completion, total tokens, latency, and calculated USD spend without monkey-patching.
  - Implemented `contextvars` metadata propagation in `app/cost_tracking/context.py` (`agent_name`, `school_id`, `batch_id`, `task_name`).
  - Added database persistence with PostgreSQL table `openai_cost_logs` (Alembic migration `f5b7218ac93d_add_openai_cost_logs.py`) and graceful fallback appending to `logs/openai_costs.jsonl`.
  - Added dynamic model pricing configuration via `OPENAI_INPUT_COST_PER_M` and `OPENAI_OUTPUT_COST_PER_M` for custom models (`gpt-6-luna`).
  - Built backend API endpoints: `GET /api/costs/summary` (aggregate metrics & agent breakdown) and `GET /api/costs/invocations` (paginated invocation logs).
  - Created frontend `CostMonitorView.tsx` (`/costs`) with 4 KPI summary cards, visual per-agent expenditure horizontal bars, search filters, CSV export, and 10-second live polling.
  - Added "Cost & Token Monitor" to sidebar navigation under `AI AGENTS`.
- [x] **Task 2.6: Comprehensive Code Review Remediation & Production Hardening**
  - **Critical Fixes**:
    - Fixed schema mismatch in `backend/app/api/routes/jobs.py` by aligning with `CrawlJobModel` and adding `agent_name` and `product_name` columns via Alembic migration `b7c19a4e2311`.
    - Removed synthetic mock fixture returns from `published.py`, querying authentic `resolved_values` where `review_status == 'approved'`.
    - Replaced in-memory demo prompts in `prompts.py` with PostgreSQL-persisted `PromptTemplateModel` ORM entity and automatic initial seed function.
    - Fixed FastAPI dependency misconfiguration in `audit.py` by removing default `None` from `background_tasks: BackgroundTasks`.
  - **Important Fixes**:
    - Replaced unvalidated raw dictionary returns with typed Pydantic v2 schemas (`ReviewActionResponse`, `SourceWeightUpdateResponse`, `HealthResponse`).
    - Added genuine `SELECT 1` ping in `health.py` to prevent false-positive healthy statuses when DB is unreachable.
    - Synchronized `BatchAuditProgress` in `audit.py` with `threading.Lock()` to eliminate race conditions.
    - Replaced silent error swallowing in `deduplicator.py` with explicit `SQLAlchemyError` catching and structured warning logs.
    - Replaced all raw console `print(...)` statements in `planning_agent.py` and `rate_limiter.py` with structured `logging`.
    - Added `pool_pre_ping=True` and exception rollback guard in `app/core/database.py`.
    - Cleaned up React 19 linter warnings in `frontend/.oxlintrc.json` and ensured 0 warnings with `pnpm lint`.
  - **Nit Fixes**:
    - Deleted obsolete `backend/main.py` stub.
    - Replaced loose `Any` and `any` types in `school.py` schema and frontend `types/index.ts`.
    - Modernized SQLAlchemy boolean equality checks to `.is_(True)` and `.is_(False)` in `schools.py`.
- [x] **Task 2.7: Comprehensive School Management Subsystem (FR-2.1 to FR-2.4)**
  - **Backend**:
    - Created `POST /api/schools` backed by strictly typed Pydantic v2 `SchoolCreateSchema` (`model_config = ConfigDict(str_strip_whitespace=True)`), enforcing field bounds and safe defaults for all 20+ non-nullable PostgreSQL columns (`is_active`, `is_tefa_approved`, `dual_language`, `before_after_care`, `transportation_provided`, `stem_program`, `open_enrollment`, `packet_available`, etc.).
    - Extended `PATCH /api/schools/{id}` with `SchoolUpdateSchema` supporting updates for `email`, `description`, `type`, `grades`, and academic tags.
    - Added `DELETE /api/schools/{id}` with safe cascading detachment of `batch_schools` linkages and `SchoolActionResponse`.
    - Enhanced `GET /api/schools` with server-side pagination (`page`, `page_size`, `total_count`, `total_pages`), multi-facet filtering (text search on name/city/state, verification status, classification type, missing website toggle), and sorting (`name_asc`, `name_desc`, `newest`, `oldest`).
  - **Frontend UI & Components**:
    - Redesigned `SchoolLibraryView.tsx` (`/schools`) with 4 KPI summary cards (Total Registered, Verified Profile %, Missing Website, Active Pipeline Ingested), multi-facet search/filtering toolbar, bulk selection controls, batch assignment trigger, and responsive server-side pagination (25/50/100 records per page).
    - Built `SchoolDetailModal.tsx` for 3-tab deep inspection (Overview & Location, Academics & Classification, Agent Data Products coverage matrix with live Tavily/Firecrawl DQA audit trigger).
    - Built `EditSchoolModal.tsx` for granular metadata editing and classification tag toggling.
    - Built `CreateSchoolModal.tsx` with instant validation for manual school registry additions.
    - Built `AssignToBatchModal.tsx` allowing multi-selected schools to be assigned to an existing batch or automatically create a new batch.
    - Added `School Management` route and navigation item with `GraduationCap` icon in `Sidebar.tsx`.

---

## Milestone 3: Data Products & Extraction (Remaining 9 Agents)

- [ ] **Task 3.1: Data Product Registry & Multi-Agent Engine**
  - Seed Open Seats, Tuition Rates, SPED, Curriculum, Athletics, etc.

- [x] **Task 3.2: Scraper Content Cache & Bypass Toggle (FR-5.3)**
  - Persist scraped markdown by SHA-256 URL hash in `scraped_pages_cache` with 14-day TTL.
  - Added on-demand "Bypass Scraper Cache (Force Fresh Live Scrape)" toggle in `AgentsOperateView.tsx` and `RunMetadataAgentModal.tsx`.
  - Propagated `force_refresh` parameter through API routes and `ExtractionAgent.scrape_website`.

---

## Milestone 4: ERCIE Resolution Engine

- [ ] **Task 4.1: Candidate Matchmaking & Value Grouping**
- [ ] **Task 4.2: 4-Component Confidence Scoring Calculation**
- [ ] **Task 4.3: Automated Decision Routing Bands (Auto-Publish vs HITL)**

---

## Milestone 5: HITL Review & Learning Loop

- [x] **Task 5.1: Minimalist School-Centric Review Workspace (FR-9.1 to FR-9.6)**
  - Group pending review items by unique `school_id` with campus address preview and pending field count.
  - High-density Field Matrix comparing Current Value vs. AI Extracted Value with confidence chips.
  - 1-Click "Approve Entire School Profile" hero action (`POST /api/review/{output_id}/approve`) cascading verified status to `schools` and `batch_schools`.
  - Expandable verbatim scraped evidence quote callout showing exact Firecrawl markdown extracts and source links.
  - Inline fast editing (`POST /api/review/{output_id}:{field_name}/correct`) directly within the table row.
  - Single-field approve, edit, and reject buttons.
- [x] **Task 5.2: Pipeline Runs History & Multi-Format Export Engine (HTML, Excel, CSV)**
  - Dedicated `/runs` history page tracking all batch executions, DQA scores, and verification splits.
  - Interactive `/runs/:jobId` school-by-school output inspector with extracted metadata fields.
  - Standalone, self-contained HTML report generation service (`HtmlReportService`) with embedded CSS for client distribution.
  - Professional `.xlsx` spreadsheet workbook generator via `openpyxl` with styled headers and status highlights.
  - Standard RFC 4180 CSV export stream.
- [ ] **Task 5.3: Feedback Loop & Dynamic Weight Drift Update**
- [ ] **Task 5.4: Golden Record Publishing Engine**

---

## Milestone 6: Enterprise Frontend Architecture (Axios & Zustand Migration)

- [x] **Task 6.1: Decouple Global Trash Bucket (`/trash`)**
  - Created standalone `TrashBucketView.tsx` with 30-day retention policies, countdown chips, and bulk purge.
  - Added `/trash` route to `App.tsx` and `Sidebar.tsx` under CORE OPERATIONS.
  - Streamlined `BatchListView.tsx` and `BatchDetailView.tsx` by removing redundant agent buttons and trash tabs.
  - Replaced all 8 native browser `alert()` and `confirm()` dialogs with styled Tailwind modals and non-blocking in-app toasts.

- [x] **Task 6.2: Centralized Axios Client & Error Interceptors (`frontend/src/services/client.ts`)**
  - Installed `axios` and `zustand` via `pnpm add zustand axios`.
  - Configured singleton `apiClient` with base URL, 30-second timeout, and bearer token request interceptor.
  - Implemented response error interceptor normalizing FastAPI string errors, 422 Pydantic validation error lists, and network errors into readable `ApiError` instances.
  - Refactored `api.ts` (all 25+ functions) to cleanly delegate to `apiClient` while retaining full backward-compatible method signatures.

- [x] **Task 6.3: Domain-Driven Modular Zustand Stores (`frontend/src/stores/`)**
  - Built `useAppStore`: RBAC roles (`Admin` | `Reviewer` | `Viewer`), global toasts (`success`, `error`, `info`), AI Copilot drawer.
  - Built `useBatchStore`: Batch intake, listing, KPI computations, and school membership.
  - Built `useTrashStore`: 30-day quarantine retention, restore actions, permanent deletion, and purge.
  - Built `useSchoolStore`: Master school catalog (100k+ rows), server pagination, multi-criteria filters, and bulk activation toggles.
  - Built `useAgentStore`: Agent registry, multi-batch execution targeting, and active job polling loops.
  - Built `useReviewStore`: ERCIE review queue, field approvals, inline corrections, and 1-click school profile approvals.
  - Built `useGovernanceStore`: Sources ranking, weights calculation, published datasets, and OpenAI cost monitoring.
  - Built `useBatchRunStore`: Historical execution runs, detail inspection, and standalone report exports (HTML/Excel/CSV).
  - Created barrel export in `frontend/src/stores/index.ts`.

- [x] **Task 6.4: Page & Component Integration & Verification**
  - Connected `App.tsx`, `Header.tsx`, `BatchListView.tsx`, `BatchDetailView.tsx`, `TrashBucketView.tsx`, `SchoolLibraryView.tsx`, `AgentsOperateView.tsx`, `ReviewQueueView.tsx`, `SourceRankingView.tsx`, `PublishedDataView.tsx`, `BatchRunsListView.tsx`, and `BatchRunDetailView.tsx` to Zustand stores.
  - Verified static TypeScript compilation: `pnpm tsc -b` (0 errors).
  - Verified Oxlint code quality: `pnpm lint` (0 warnings, 0 errors on 51 files).
  - Verified production Vite build: `pnpm build` (completed in 387ms).
  - Verified backend code quality: `uv run ruff check app` (all checks passed).

---

## Milestone 7: Staging Isolation & Results View Architecture Rework

- [x] **Task 7.1: Staging Schools Table (`staging_schools`) & Intake Decoupling**
  - Designed and created `StagingSchoolModel` (`staging_schools` table) via Alembic migration (`3d8f1e2a9b4c`).
  - Added `staging_school_id` foreign keys to `metadata_agent_outputs` and `evidence_records` via Alembic migration (`4e9a2b1c8f3d`).
  - Decoupled batch upload confirmation in `BatchService.confirm_and_create_batch` to insert strictly into `staging_schools`.
  - The production `schools` table now serves exclusively as an authoritative golden table protected from unvalidated intake data.

- [x] **Task 7.2: School Promotion Engine (`SchoolPromotionService`)**
  - Built `SchoolPromotionService.promote_staging_school` in `app/services/promotion/school_promotion_service.py`.
  - Promotes verified staging records into `schools`, populating `production_school_id` and updating staging status to `published`.
  - Integrated promotion endpoint `POST /api/results/{staging_id}/promote`.

- [x] **Task 7.3: Results API & Multi-Format Exports (`/api/results`)**
  - Created `app/api/routes/results.py` and schemas in `app/schemas/results.py`.
  - Implemented dynamic product value resolution (`value1`, `value2`, `value3`) for Open Seats, Metadata, Tuition, and Admissions.
  - Implemented `/api/results/export/excel`, `/api/results/export/csv`, and `/api/results/export/html`.

- [x] **Task 7.4: Results Page UI & Dropdown Filters (`ResultsView.tsx`)**
  - Rebranded "Pipeline Runs" navigation to "Results" (`/results`) under REVIEW & PUBLISH.
  - Built `ResultsView.tsx` with Batch dropdown (`All batches` + live batches) and Product dropdown (`Open Seats`, `School Profile & Metadata`, etc.).
  - Added real-time school filtering, records counter, and multi-format export buttons (`Export Excel`, `Export CSV`, `HTML view`).
- [x] **Task 7.6: Metadata Agent & Results View 1:1 Alignment**
  - Aligned schema knowledge base in `audit_service.py` and `schemas.py` with all 14 canonical fields (`name`, `grades`, `address`, `full_address`, `website`, `phone`, `email`, `description`, `open_enrollment`, `base_tuition`, `extracurricular_programs`, `learning_models`, `teaching_style`, `open_enrollment_grades`).
  - Fixed staging school `AttributeError` in `SchoolAuditService.audit_single_school`.
  - Built full 14-field post-ingestion record matching standalone `results.json` directly into `MetadataAgentOutputModel.extracted_fields`.
  - Streamlined Results table list by completely removing arbitrary `VALUE 1`, `VALUE 2`, `VALUE 3` columns; focused view on School & District, Official Website link, DQA Score pill, Status badge, Evidence citations, and Timestamp.
  - Set default product in Results view to `info` ("School Profile & Metadata").
  - Enhanced slide-over inspection drawer with structured cards for Core Profile, Contact, Academics, Admissions, Citations with verbatim quotes, and 1-click "Copy JSON" button (`results.json`).
  - Updated CSV, Excel, and HTML export endpoints to output all 17 metadata columns.
  - Verified with `uv run ruff check app` (0 errors), `pnpm exec tsc -b` (0 errors), and `pnpm build` (clean in ~340ms).

- [x] **Task 7.7: Purge & Removal of Non-Metadata Agents**
  - Pruned `AGENT_REGISTRY` in `backend/app/api/routes/agents.py` down to strictly the single active `metadata_agent_v1` (`School Profile & Metadata Agent`, product `info`), removing 9 placeholder stubs.
  - Pruned `PRODUCT_SPECS` in `backend/app/api/routes/results.py` to strictly `info`, eliminating synthetic mock fallback resolvers.
  - Simplified batch intake metadata initialization in `backend/app/services/batches/batch_service.py` to `{"products": {"info": {"status": "not_run"}}}`.
  - Updated job orchestration default schemas in `backend/app/schemas/job.py` to `MetadataAgent`.
  - Pruned `PRODUCT_OPTIONS` in `frontend/src/pages/ResultsView.tsx` to strictly `School Profile & Metadata`.
  - Simplified batch detail product table columns in `frontend/src/pages/BatchDetailView.tsx` from 6 columns down to a single clean `Profile & Metadata` column.
  - Streamlined `SchoolDetailModal.tsx`, `JobMonitorView.tsx`, `api.ts`, and `CopilotDrawer.tsx` to reference `MetadataAgent`.
  - Verified clean static checks: `uv run ruff check app` (0 errors), `pnpm exec tsc -b` (0 errors), and `pnpm lint` (0 errors).

- [x] **Task 7.8: Staging Schools Trash Bucket Integration**
  - Updated `BatchService.drop_school_from_batch` to soft-delete dropped staging schools (`deleted_at = now()`) with session flush and dynamic batch count recalculation instead of hard deleting.
  - Updated `BatchService.get_batch_detail` to exclude soft-deleted staging schools (`StagingSchoolModel.deleted_at.is_(None)`).
  - Resolved FastAPI route shadowing on `/schools/trash` by declaring trash endpoints before the parameterized `/{school_id}` route.
  - Updated `GET /api/schools/trash` to query and list soft-deleted `staging_schools`.
  - Updated `POST /api/schools/{id}/restore` to restore dropped staging schools and increment batch membership count.
  - Updated `DELETE /api/schools/{id}/permanent` and `POST /api/schools/trash/purge-expired` to clean staging records.
  - Verified live: dropping a school moves it directly into the Trash Bucket, and restoring it returns it to the batch.

- [x] **Task 7.9: Batch School Count Synchronization Across List & Detail Views**
  - Added session `db.flush()` in `restore_school`, `delete_school`, and `permanent_delete_school` before querying active staging counts so un-deleted records are immediately reflected in PostgreSQL queries.
  - Implemented dynamic aggregation in `BatchService.list_batches` and `list_trash_batches` using `func.count(StagingSchoolModel.id)` filtered on `deleted_at.is_(None)`, ensuring self-healing count synchronization.
  - Verified end-to-end: `/batches` KPI card, `/batches` table, and `/batches/:id` detail view are 100% synchronized at 5 schools (and 4 when 1 is trashed).

---

*Last Updated: 2026-09-30 • Maintained continuously per `docs-maintenance` & `task-tracking` standards*



---

## Milestone 9: Pytest Test Suite (Incremental — One API at a Time)

### 🎯 Objective
Establish a comprehensive pytest test suite covering all 13 API routes, 3 service layers, and 2 unit-helper modules. Tests are written **session by session** (one module per working session). See `pytest_plan.md` artifact for the full test inventory (~197 tests across 18 files).

**Test runner:** `uv run pytest tests/ -v`
**Linting:** `uv run ruff check tests/ --fix && uv run ruff format tests/`

---

### 📋 Session Progress

- [x] **Session 1: Test Infrastructure Setup**
  - Installed `pytest`, `pytest-asyncio`, `httpx` via `uv add --dev`.
  - Created `backend/tests/__init__.py`, `tests/api/__init__.py`, `tests/services/__init__.py`, `tests/unit/__init__.py`.
  - Created `backend/tests/conftest.py`: session-scoped SQLite in-memory engine, per-test rolled-back DB session, FastAPI TestClient with `get_database_session` dependency override.
    - Handles `Schools` model's PostgreSQL-only `JSONB`/`UUID` types via `_patch_pg_types_for_sqlite()`.
    - Deduplicates SQLAlchemy indexes via `_deduplicate_indexes()` to avoid SQLite `index already exists` errors.
  - Created `backend/tests/factories.py`: factory helpers for all ORM models.
  - Added `[tool.pytest.ini_options]` to `pyproject.toml` (testpaths, pythonpath, asyncio_mode).

- [x] **Session 2: Health API Tests (`tests/api/test_health.py`)**
  - 7 tests — all passing ✅
  - Covers: HTTP 200, schema fields, `status=healthy`, `database=connected`, version/application strings, degraded path when DB raises `OperationalError`.

- [x] **Session 3: Sources + Prompts API Tests** — `tests/api/test_sources.py` (8 tests), `tests/api/test_prompts.py` (16 tests) — all 24 passing ✅
- [x] **Session 4: Jobs + Costs API Tests** — `tests/api/test_jobs.py` (10 tests), `tests/api/test_costs.py` (10 tests) — all 20 passing ✅
- [x] **Session 5: Published API Tests** — `tests/api/test_published.py` (4 tests) — all 4 passing ✅
- [x] **Session 6: Service Unit Tests (FileParser + Deduplicator)** — `tests/services/test_batch_file_parser.py` (9 tests), `tests/services/test_deduplicator.py` (14 tests) — all 23 passing ✅
- [x] **Session 7: Schools API Tests** — `tests/api/test_schools.py` (25 tests) — all 25 passing ✅
- [x] **Session 8: Batches API Tests** — `tests/api/test_batches.py` (22 tests) — all 22 passing ✅
- [x] **Session 9: Review API Tests** — `tests/api/test_review.py` (17 tests) — all 17 passing ✅
- [x] **Session 10: Results + Runs API Tests** — `tests/api/test_results.py` (11 tests), `tests/api/test_runs.py` (8 tests) — all 19 passing ✅
- [x] **Session 11: Audit Pipeline API Tests** — `tests/api/test_audit.py` (9 tests) — all 9 passing ✅
  - Covers: Batch audit progress tracker (`start`, `finish`, `record_outcomes`), `GET /api/audit/batch/{id}/status`, `POST /api/audit/school/{id}` (success, 404 not found, 500 error), `POST /api/audit/batch/{id}/run` (no inactive schools, with inactive schools, 409 conflict when already running).
- [x] **Session 12: Agents API + BatchService Tests** — `tests/api/test_agents.py` (18 tests), `tests/services/test_batch_service.py` (20 tests) — all 38 passing ✅
  - `test_agents.py`: Agent registry, multi-agent dispatch (single, group, batch scopes, legacy fallback, skipped unimplemented agents), job progress calculation, status filtering, and job action controls (pause, resume with workers, cancel).
  - `test_batch_service.py`: Intake upload preview generation, confirm and create batch (staging school isolation), list batches with dynamic count aggregation, lifecycle (update, soft-delete, restore, permanent-delete), add/drop schools, purge expired trash, get batch detail.
- [x] **Session 13: Helper Unit Tests** — `tests/unit/test_html_report_service.py` (10 tests), `tests/unit/test_cost_recorder.py` (10 tests) — all 20 passing ✅
  - `test_html_report_service.py`: Value formatting (`_format_val`), boolean & empty states, list formatting, XSS escaping, standalone HTML report assembly, KPI metric calculations.
  - `test_cost_recorder.py`: `CostContext` contextvars isolation, DB recording with graceful JSONL fallback, OpenAI client proxy cost interception for structured (`beta.chat.completions.parse`) and unstructured (`chat.completions.create`) requests.

---

### 📈 Final Pytest Totals (Milestone 9 Complete)

| Category | Files | Tests Written | Tests Passing |
|---|---|---|---|
| Infrastructure | 5 | — | — |
| API Tests | 13/10 | 165 | ✅ 165 |
| Service Tests | 3/3 | 43 | ✅ 43 |
| Unit Tests | 2/2 | 20 | ✅ 20 |
| **Total** | **23/20** | **228** | **✅ 228** |

---

## Milestone 10: Parallel Worker Concurrency & Interactive Job Controls (Pause, Resume, Cancel)

### 🎯 Objective
Empower operators to safely control long-running web crawling and LLM extraction jobs directly from the UI with configurable worker concurrency (1 to 5 threads), thread-safe rate-limit adherence (6.0s spacing for Firecrawl, 1.5s for Tavily), and smart-skip protection for already-verified schools.

### 📋 Detailed Sub-Tasks:

- [x] **Task 10.1: Backend Schema Upgrades (`workers` field & `JobActionResponse`)**
  - Added `workers: int = Field(default=2, ge=1, le=5)` to `RunMetadataAgentRequest` and `RunAgentsForBatchRequest`.
  - Added `'paused'` and `'cancelled'` status literals to `AgentJobSummary`.
  - Added `JobActionResponse` schema (`job_id`, `batch_id`, `status`, `message`).

- [x] **Task 10.2: Thread-Safe Concurrency & Halt Detection in Batch Worker**
  - Implemented `ThreadPoolExecutor(max_workers=concurrency)` in `_run_batch_metadata_worker`.
  - Added dynamic `_is_job_halted(job_id)` checking DB status before processing each school to break loops cleanly on Pause or Cancel.
  - Allocated isolated DB sessions per worker thread via `get_database_session()`.
  - Maintained global 6.0s and 1.5s API spacing via `threading.Lock()` in `ApiRateLimiter`.

- [x] **Task 10.3: Job Control REST Endpoints & Smart-Skip Protection**
  - `POST /api/agents/jobs/{job_id}/pause`: Sets job status to `Paused` and batch status to `paused`.
  - `POST /api/agents/jobs/{job_id}/resume?workers={N}`: Resumes unverified schools, resets any stuck crawling schools to pending, and re-launches worker thread pool.
  - `POST /api/agents/jobs/{job_id}/cancel`: Sets job status to `Cancelled`, resets crawling schools to pending, and marks batch ready.
  - Implemented smart-skip filtering in `POST /api/agents/run-for-batch` to skip schools in `needs_verification` or `verified` status unless `force_refresh=True`.

- [x] **Task 10.4: Frontend UI Controls (Operate View, Job Monitor, Batch Detail)**
  - Added `workers?: number` and `JobActionResponse` to TypeScript definitions (`frontend/src/types/index.ts`).
  - Added `pauseJob`, `resumeJob`, and `cancelJob` to `frontend/src/services/api.ts`.
  - `AgentsOperateView.tsx`: Concurrency selector dropdown (1 to 5 workers) in Action Bar; interactive Pause, Resume, and Cancel buttons on active job rows; Paused and Cancelled status chips.
  - `JobMonitorView.tsx`: Pause, Resume, and Cancel table actions; auto-polling for active jobs.
  - `BatchDetailView.tsx`: Paused alert banner with 1-click "Resume in Monitor" button.
  - `RunMetadataAgentModal.tsx`: Added Parallel Workers selector (1 to 5 workers) for modal launches.

- [x] **Task 10.5: Automated Verification & Test Coverage**
  - Backend: 228 passing pytests (`uv run pytest tests/ -v`).
  - Backend Lint: `uv run ruff check app tests` (0 errors).
  - Frontend Typecheck: `pnpm exec tsc -b` (0 errors).
  - Frontend Lint: `pnpm lint` (0 errors).

---

## Milestone 11: UI Usability & Explicit Action Labels

### 🎯 Objective
Eliminate ambiguity across all operator tables and dialogs by replacing icon-only buttons with explicit, human-readable action labels and accessible titles.

### 📋 Detailed Sub-Tasks:
- [x] **Task 11.1: Verification & Quality Queues Action Buttons**
  - `ReviewQueueView.tsx`: Added `Refresh` button label; replaced icon-only row buttons with `Inspect`, `Reject`, and `Approve` pill buttons.
  - `ApprovedSchoolsView.tsx`: Added `Refresh` button label; replaced row buttons with `Inspect` and `Undo` pill buttons.
  - `RecrawlQueueView.tsx`: Added `Refresh` button label; replaced row buttons with `Inspect`, `Undo`, and `Re-crawl` pill buttons.
  - `SchoolEvidenceDrawer.tsx`: Added accessible `aria-label="Close Drawer"` and `title="Close"` to modal header.
- [x] **Task 11.2: School Directory & Batch Operations Action Buttons**
  - `SchoolLibraryView.tsx`: Updated row action buttons to explicit `View`, `Edit`, and `Delete` labels; added `Prev` and `Next` labels to pagination buttons.
  - `BatchDetailView.tsx`: Replaced icon-only back arrow with `Back to Batches`; made school `Drop` button text unconditionally visible.
  - `CreateBatchView.tsx`: Replaced icon-only back arrow with `Back to Batches`.
  - `ActiveBatchesTable.tsx`: Removed `hidden sm:inline` on `Edit` and `Delete` buttons for persistent visibility across all viewports.
- [x] **Task 11.3: Reporting & Monitoring Views Action Buttons**
  - `BatchRunsListView.tsx`: Added `Inspect`, `HTML`, `Excel`, and `CSV` text labels to row action buttons.
  - `CostMonitorView.tsx`: Added `Prev` and `Next` labels to invocation log pagination buttons.
- [x] **Task 11.4: End-to-End Verification**
  - Frontend: `pnpm exec tsc -b` (0 errors) and `pnpm lint` (0 errors).
  - Backend: `uv run ruff check app` (0 errors).

## Milestone 12: Approved Schools Production Publishing (Phase 1)

### 🎯 Objective
Enable operators to promote verified records from `staging_schools` directly into the authoritative master production `schools` catalog. This serves as the prerequisite foundation for Phase 2 (Sandbox live database ingestion).

### 📋 Detailed Sub-Tasks:
- [x] **Task 12.1: Backend Schema & Review Route Extensions**
  - Added `is_published: bool = False` and `production_school_id: str | None = None` to `VerificationSchoolItem`.
  - Added `"publish"` literal to `BulkReviewActionRequest` and `BulkReviewActionResponse`.
  - Extended `GET /api/review/schools?queue_type=approved` to query both `"approved"` and `"published"` records from `staging_schools`.
  - Extended `POST /api/review/bulk-action` to handle `action == "publish"` across `single`, `group`, and `batch` scopes via `SchoolPromotionService.promote_staging_school()`.
  - Sets `staging.status = 'published'`, generates/updates the master `Schools` row, links `staging.production_school_id`, and repoints metadata outputs & evidence records.
- [x] **Task 12.2: Frontend Types & State Management**
  - Extended `VerificationSchoolItem` and `executeAction` in `frontend/src/types/index.ts` and `frontend/src/stores/reviewStore.ts` with `'publish'`.
- [x] **Task 12.3: Approved Schools UI & Safety Modals (`ApprovedSchoolsView.tsx`)**
  - Added `[ 🚀 Publish Approved Batch ]` batch hero button in header.
  - Added `[ 🚀 Publish Selected ]` action in multi-select action bar.
  - Added status badge distinguishing `"Verified"` (emerald) from `"Published"` (blue).
  - Added per-row `[ 🚀 Publish ]` button calling `handlePublishSingle(school)` (or `"Published"` tag if already promoted).
  - Added double-confirmation modal (`confirmPublishAction`) detailing promotion to the master `Schools` catalog.
  - Added `[ 🚀 Publish to Production Schools ]` button in `<SchoolEvidenceDrawer>`.
- [x] **Task 12.4: Automated Test Suite & Quality Gates**
  - Added 3 unit tests in `backend/tests/api/test_review.py` testing single publish, batch publish, and queue partition querying.
  - Backend: 231 passing pytests (`uv run pytest -q`).
  - Backend Lint: `uv run ruff check app tests` (0 errors), `uv run ruff format app tests`.
  - Frontend: `pnpm exec tsc -b` (0 errors), `pnpm lint` (0 errors), `pnpm build` (clean bundle).

## Milestone 13: Intake Attribute Preservation & Grades Resolution (Missing Grades Fix)

### 🎯 Objective
Resolve missing grades across batch intake, live crawling, and the human-in-the-loop Verification Queue. Ensure that all intake source fields (`grades`, `phone`, `email`, `type`) are fully ingested and preserved into `staging_schools`, that the LLM extraction agent can infer standard grade spans when school levels are established, and that existing batch records are remediated.

### 📋 Detailed Sub-Tasks:
- [x] **Task 13.1: Intake Schema & Staging Persistence (`backend/app/schemas/batch.py`, `backend/app/services/batches/`)**
  - Added `phone`, `email`, `type`, and `grades` fields with `_normalize_string_list` validators to `IntakeRowPreview` and `BatchConfirmRow`.
  - Updated `build_intake_preview_row` in `deduplicator.py` to extract `phone`, `email`, `type`, and `grades` from raw input rows (JSON arrays or comma-delimited).
  - Updated `confirm_and_create_batch` in `batch_service.py` to populate `staging_school.grades`, `phone`, `email`, and `type`, and retain `original_grades` in `source_data`.
  - Updated frontend `types/index.ts` and `CreateBatchView.tsx` to pass through `grades`, `phone`, `email`, and `type` during batch creation.
- [x] **Task 13.2: Extraction Agent Prompt Enhancements (`backend/app/pipelines/audit_crawler/extraction_agent.py`)**
  - Enhanced Rule 7 (Grades Resolution Hierarchy) with Tier 4 School Level Inference:
    - Elementary School: `['Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade']`
    - Middle School: `['6th grade', '7th grade', '8th grade']`
    - High School: `['9th grade', '10th grade', '11th grade', '12th grade']`
    - Retains existing verified DB grades under Rule 2 if site lacks explicit grade listings.
- [x] **Task 13.3: Database Remediation (`backend/app/scripts/remediate_batch_100_grades.py`)**
  - Created and executed historical remediation script matching records against `/home/aron/Desktop/workbase/CampusCrawler/qa_batch_872/input_schools_100.json`.
  - Remediated 100 schools in 'batch 100' and 'Creative Little Minds' in 'San Antonio'.
  - Updated `staging_schools.grades` and `MetadataAgentOutputModel` (`extracted_fields` and `recommendations`).
  - Missing grades in the Verification Queue dropped from 43 to 0.
- [x] **Task 13.4: Automated Test Suite & Quality Gates**
  - Added unit test in `backend/tests/services/test_deduplicator.py` verifying preview extraction of `grades`, `phone`, `email`, and `type`.
  - Added assertions in `backend/tests/services/test_batch_service.py` verifying persistence of `grades`, `phone`, `email`, and `type` on `StagingSchoolModel`.
  - Backend: 232 passing pytests (`uv run pytest tests/ -q`).
  - Backend Lint: `uv run ruff check app tests` (0 errors), `uv run ruff format app tests`.
  - Frontend: `pnpm exec tsc -b` (0 errors), `pnpm lint` (0 errors).

---

*Last Updated: 2026-10-01 • Maintained continuously per `docs-maintenance` & `task-tracking` standards*

