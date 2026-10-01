SchoolPath | AI Data Operations Platform | Phase 1 FRD
SCHOOLPATH
AI Data Operations Platform
Phase 1 Functional Requirements Document
UI / Control Layer for Multi-Agent Data Operations — Enhanced Phase 1


Document Status
	Draft for Development
	Scope
	Phase 1 — Operational UI / Control Layer
	Primary Users
	Admin, Reviewer, Viewer
	Agent Model
	Approximately 10 existing backend agents, one per data product
	Initial Intake
	Excel import; data-pipeline ingestion to follow
	________________


1. Purpose
This Phase 1 FRD defines the functional scope for the SchoolPath AI Data Operations Platform (AI-DOP) as an operational UI and control layer for approximately ten existing AI data-product agents. The objective is to provide operators with a single place to ingest school datasets, organize them into named batches, run data-product agents, monitor jobs, review and verify outputs, publish verified records to the AI-DOP production database, and synchronize verified records to the SchoolPath sandbox.
The upstream crawling/data pipeline remains a separate application running in EC2. That application continues to crawl the internet and extract school information and addresses. Phase 1 AI-DOP consumes that upstream dataset rather than replacing the crawler.
1.1 Phase 1 Objective
* Operate multiple existing agents through one UI and a controlled backend job layer.
* Provide visibility into schools, batches, products, jobs, verification, and publication status.
* Support Excel-based batch intake initially, with a clean extension point for automated pipeline ingestion.
* Allow an operator to run a selected data-product agent for a selected batch immediately or through scheduling/queueing.
* Provide a human-in-the-loop verification workflow with comments and re-crawl flags.
* Publish verified product data to the AI-DOP production database and synchronize it to the SchoolPath sandbox through an API.
* Keep the platform extensible so additional agents/products can be registered without redesigning the UI.
* Develop LOG for agentic operation and log the token usage, schools number got searched etc.
1.2 Reference to Existing AI-DOP Specification
The existing Complete System Specification defines a broader operational, intelligence, learning, and frontend platform. It establishes the concepts of schools, data products, agent contracts, requests/jobs, evidence, review, publishing, schedules, audit, and role-based access. It also explicitly separates the Operational Platform as Phase 1 from ERCIE intelligence and Adaptive Learning phases. This FRD narrows that broader specification into the practical Phase 1 build required for operating the existing agents. 
Source basis: the existing specification defines Phase 1 as “Acquire, validate, orchestrate, review, publish.” It also states that agents plug in behind a stable contract and that the frontend should remain thin and role-aware. fileciteturn2file1L249-L260
2. Scope
2.1 In Scope
* Authentication and role-based access.
* School library and school status visibility.
* Excel batch creation/import and batch management.
* Data-product and agent registry/configuration.
* Agent execution for a selected batch.
* Queueing, scheduling, concurrency control, job monitoring, failure handling, and retry.
* Agent output/result viewing in UI.
* Evidence/source visibility for returned values.
* Human verification, correction/approval, comments, and re-crawl flags.
* Per-school and per-product status tracking.
* Promotion of verified records into the AI-DOP production database.
* Export of results to Excel/CSV and a simple browser/HTML-compatible view.
* API-based synchronization from AI-DOP production to SchoolPath sandbox.
* Audit trail for important operator actions.
* Basic automation/scheduling capability.
2.2 Out of Scope for Phase 1
* Replacing or rebuilding the EC2 crawling/data-pipeline application.
* Advanced ERCIE resolution, confidence formulas, source ranking, and adaptive learning as configurable UI capabilities.
* Prompt Studio, AI Copilot, learning analytics, automated source optimization, and advanced intelligence dashboards.
* Complex conflict visualization and autonomous publishing decisions.
* A full data-entry/editorial CMS for school data.
* Full downstream SchoolPath production integration; Phase 1 targets sandbox synchronization.
* Complex multi-stage workflow automation beyond batch → agent job → review → publish → sandbox sync.
3. Product / Operating Model
AI-DOP is the operational control plane. Agents remain independently developed backend services. The UI does not contain agent logic; it creates work, sends it through the orchestration layer, displays agent output, and captures human decisions.
Step
	Input
	AI-DOP Action
	Backend
	Human Action
	Output
	1. Intake
	School dataset
	Create/import batch
	Validate and persist schools
	Review intake exceptions
	Batch + schools
	2. Select
	Batch + product
	Choose agent/product
	Create request/job
	Optionally set priority/schedule
	Queued job
	3. Execute
	Job
	Monitor execution
	Dispatch to existing agent
	Monitor only
	Evidence/results
	4. Review
	Agent output
	Present results/evidence
	Persist result + provenance
	Verify/correct/comment/flag
	Verified product record
	5. Publish
	Verified records
	Publish action
	Upsert production DB
	Admin controls publish
	AI-DOP production data
	6. Sync
	Published records
	Sync to sandbox
	API upsert
	Monitor result
	SchoolPath sandbox data
	4. Users and Roles
Role
	View
	Operate Jobs
	Verify / Publish
	Admin
	All platform data and settings
	Create batches, run/schedule agents, retry jobs
	Verify, publish, manage integrations and configuration
	Reviewer
	Schools, batches, jobs, results
	Monitor jobs
	Verify/correct/comment/flag for re-crawl; no production configuration
	Viewer
	Read-only operational data
	No
	View/export verified/published data
	The source specification defines Admin, Reviewer, and Viewer roles and assigns Admin control over requests, schedules, school management, publishing, and configuration; Reviewers can monitor and review; Viewers can view/export. fileciteturn1file2L121-L147
5. Functional Requirements
5.1 Authentication and Access
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-1.1
	Users shall authenticate before accessing AI-DOP.
	Must
	Unauthenticated users cannot access operational screens or APIs.
	FR-1.2
	The platform shall enforce role-based permissions on the server and UI.
	Must
	UI hides unavailable actions and API rejects unauthorized actions.
	FR-1.3
	Important user actions shall be recorded in an audit trail.
	Must
	Action, user, timestamp, entity, and outcome are retained.
	

5.2 School Library and Status Management
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-2.1
	The system shall maintain a searchable school library.
	Must
	Search/filter by school name and available school metadata.
	FR-2.2
	The system shall show the current operational status of each school.
	Must
	At minimum show pipeline/intake, in progress, needs verification, verified, active, needs re-crawl, and error states.
	FR-2.3
	School identity shall include at least name, website, and address.
	Must
	These fields support school identity and agent targeting.
	FR-2.4
	The system shall prevent clearly invalid schools from being run until corrected or explicitly overridden by an Admin.
	Must
	Invalid records are excluded from normal execution.
	FR-2.5
	A school detail view shall show product-level processing status.
	Must
	Users can see which data products have been run, are ready for review, verified, published, or not yet run.
	

The source specification uses name, website, and address as the core school identity fields and defines Verified, Needs Review, Invalid, and Unverified validation states. fileciteturn4file0L12-L44
5.3 Batch Management and Intake
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-3.1
	The system shall allow an Admin to create a named batch.
	Must
	Example: “San Antonio District”.
	FR-3.2
	The system shall allow schools to be imported into a batch from Excel.
	Must
	Upload, validate, preview, confirm, and create/import the batch.
	FR-3.3
	The batch shall retain source/intake metadata.
	Must
	Batch name, source type, creator, created time, school count, and status.
	FR-3.4
	The system shall prevent accidental duplicate school creation where identity can be matched.
	Should
	Show potential duplicates during import and allow operator resolution.
	FR-3.5
	The design shall provide an extension point for future pipeline-based intake.
	Should
	A future ingestion adapter can create/update batches without changing the UI model.
	FR-3.6
	The batch detail screen shall summarize processing across all products.
	Must
	Show school counts and product status matrix.
	

Excel upload is consistent with the existing specification, which defines bulk school upload with a validation preview. fileciteturn4file0L32-L44
5.4 Data Product and Agent Registry
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-4.1
	The platform shall maintain a registry of data products and their assigned agents.
	Must
	Each active product maps to one agent identifier.
	FR-4.2
	The product configuration shall define the expected output schema.
	Must
	Schema drives UI columns, validation, and export.
	FR-4.3
	The platform shall support approximately ten agents without redesign.
	Must
	Agents are configuration/integration records rather than hard-coded UI pages.
	FR-4.4
	An Admin shall be able to activate/deactivate a product.
	Should
	Inactive products cannot be selected for new runs.
	FR-4.5
	The platform shall store agent version/build information for traceability.
	Should
	Job/result records identify the agent version used.
	

The source specification defines data products as configurable objects paired with an assigned agent and dynamic output schema, and states that additional products can be added without redesign. fileciteturn4file1L129-L150
5.5 Agent Execution
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-5.1
	An Admin shall select a batch and data product/agent and initiate a run.
	Must
	Run Now creates a uniquely identifiable request/job.
	FR-5.2
	The system shall support immediate and queued execution.
	Must
	The UI submits work; backend queue controls when the agent actually runs.
	FR-5.3
	The system shall support job priority.
	Should
	Priority is stored and honored by the queue.
	FR-5.4
	The platform shall prevent unintended duplicate execution of the same batch/product combination while a run is active.
	Must
	Duplicate protection/idempotency behavior is server-side.
	FR-5.5
	The platform shall receive completion/failure callbacks or equivalent responses from agents.
	Must
	Job status and returned results are persisted.
	FR-5.6
	Failed jobs shall show an error reason and allow retry.
	Must
	Retry creates a controlled new execution attempt.
	

The source specification defines the request → job lifecycle as Pending → Running → Completed/Failed, with failed jobs exposing a retry action and agents receiving school IDs plus product schema through a stable orchestration contract. fileciteturn4file2L238-L276
Execution scope clarification: An agent run may target (a) a single school, (b) a selected group of schools within a batch, or (c) the entire batch. The selected scope must be stored on the request/job so operators can see exactly which schools were targeted.
5.6 Scheduling and Capacity Control
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-6.1
	The system shall allow an Admin to schedule a product run for a batch.
	Must
	Schedule stores batch, product, cadence, next run, and status.
	FR-6.2
	The system shall support queued execution when multiple jobs are requested.
	Must
	Concurrency is controlled by backend worker/server capacity.
	FR-6.3
	The system shall support pause/resume of recurring schedules.
	Should
	Paused schedules do not create new jobs.
	FR-6.4
	The system shall allow an Admin to trigger a scheduled job immediately.
	Should
	Run Now creates a normal execution request.
	FR-6.5
	The system shall expose queue/job capacity indicators.
	Should
	Show queued, running, completed, failed counts and active workers where available.
	

The source specification separates one-time requests from recurring schedules and defines schedules that spawn standard requests on a cadence. fileciteturn4file0L104-L113
5.7 Job Monitoring
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-7.1
	The Job Monitor shall list recent and active jobs.
	Must
	Filter by batch, product, agent, status, date.
	FR-7.2
	Each job shall show execution status.
	Must
	Pending, Running, Completed, Failed.
	FR-7.3
	Each job shall show operational metrics.
	Should
	Schools processed, records/results returned, execution time, timestamps.
	FR-7.4
	The job detail shall show errors and execution history.
	Must
	Operators can diagnose and retry failed work.
	

The source specification requires Job ID, product, schools processed, records extracted, execution time, and status in the job monitor. fileciteturn4file2L250-L265
5.8 Output and Result Viewing
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-8.1
	Completed agent output shall be viewable in the AI-DOP UI.
	Must
	Results grouped by school and product.
	FR-8.2
	The UI shall show returned values using the product schema.
	Must
	Columns/fields adapt to the configured product.
	FR-8.3
	Each result shall expose available provenance/evidence.
	Must
	Show source URL/type, extraction timestamp, agent, and relevant extracted content where returned.
	FR-8.4
	Users shall be able to export results.
	Must
	Excel/CSV required; simple browser/HTML-compatible view supported.
	FR-8.5
	The output view shall distinguish raw/agent output from verified/published status.
	Must
	Users can see whether a value is still awaiting verification.
	

The source specification requires evidence to retain source URL, type, content, timestamp, and agent, and supports Excel/CSV/JSON export of approved data. fileciteturn1file8L569-L591
5.9 Human-in-the-Loop Verification
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-9.1
	The system shall provide a verification queue for completed product results.
	Must
	Filter by batch, school, product, and verification status.
	FR-9.2
	A reviewer shall be able to verify/approve a result.
	Must
	Verification records user and timestamp.
	FR-9.3
	A reviewer shall be able to correct a result when the UI supports editable fields.
	Must
	Original value and final value are retained.
	FR-9.4
	A reviewer shall be able to add comments.
	Must
	Comment is retained against the review/result.
	FR-9.5
	A reviewer shall be able to flag a school/product for re-crawl.
	Must
	Flag includes reason/comment and creates a re-crawl work item or pending action.
	FR-9.6
	Verification shall be tracked independently per school and data product.
	Must
	A school can be verified for Open Seats while Tuition remains incomplete.
	FR-9.7
	Verified status shall not imply that every other product for the school is verified.
	Must
	Status is product-specific plus an overall school/batch roll-up.
	

The source specification establishes immutable evidence and a review action model of approve/correct/reject plus comment. Phase 1 retains this review principle but simplifies the UI around verification and re-crawl operations. fileciteturn1file8L569-L591
Output interaction requirements: Every URL returned or displayed by AI-DOP shall be rendered as a clickable link that opens the source in a new browser tab/window. Comments shall be attachable to a specific output/result (and, where applicable, a specific field) rather than only to the school or batch. Each comment shall retain author and timestamp.
Bulk verification scope clarification: Approve, reject, and re-crawl actions shall support single-school, selected-group-of-schools, and whole-batch operations. The action shall also support an agent/data-product-specific scope, so an operator can approve/reject/re-crawl only the selected product output for the selected schools. Bulk actions must provide a confirmation step and show the affected school count, product/agent, and current statuses before execution.
5.10 Production Publishing
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-10.1
	The platform shall allow verified product records to be promoted to the AI-DOP production database.
	Must
	Only records meeting the Phase 1 verification rule can be promoted.
	FR-10.2
	Publishing shall be idempotent/upsert-based.
	Must
	Repeated publish actions do not create duplicate school/product records.
	FR-10.3
	The system shall retain published timestamp, user/job, product, and version information.
	Must
	Traceability is maintained.
	FR-10.4
	Publishing shall operate at product-record level as well as batch level where supported.
	Must
	A batch may contain a mix of verified and unverified products.
	

The broader specification states that only approved values publish and that published data is exportable. fileciteturn1file8L574-L591
5.11 SchoolPath Sandbox Synchronization
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-11.1
	AI-DOP shall provide a server-side API integration to SchoolPath sandbox.
	Must
	No direct browser-to-database writes.
	FR-11.2
	The sandbox data model shall use the same canonical schema as the AI-DOP production data model for synchronized records.
	Must
	Field names/types/IDs are compatible for clean upsert.
	FR-11.3
	The sync operation shall be available from the AI-DOP UI.
	Must
	Admin can select verified/published records and trigger sync.
	FR-11.4
	The sync API shall use stable SchoolPath school IDs and product identifiers.
	Must
	Identity remains consistent across environments.
	FR-11.5
	Sync results shall be visible.
	Must
	Success, partial success, and failure are recorded per school/product where possible.
	FR-11.6
	The integration shall support retry without creating duplicate records.
	Must
	Idempotency key or equivalent upsert behavior.
	

This sandbox integration is a Phase 1 extension of the publish flow described by the project requirement; the existing source specification itself establishes versioned/published data and configurable product schemas, which should be preserved in the integration design. fileciteturn1file9L643-L654
5.12 Export
ID
	Functional Requirement
	Priority
	Acceptance / Expected Behavior
	FR-12.1
	Users shall export a batch/product result to Excel.
	Must
	Export follows the configured product schema.
	FR-12.2
	Users shall export CSV where appropriate.
	Should
	Useful for engineering/data workflows.
	FR-12.3
	Users shall have a simple HTML/browser view of results.
	Should
	Readable prototype/report view without requiring file download.
	FR-12.4
	Exports shall indicate verification/publish status.
	Must
	Status metadata accompanies the result.
	

6. Status Model
The following Phase 1 status model is intentionally simple. Statuses should be explicit at the school, product, batch, and job levels.
Entity
	Status
	Meaning
	Next Action
	School
	Intake
	School has entered AI-DOP through Excel or upstream pipeline intake.
	Validate / assign to batch
	School
	Active
	School is active in the operational library and available for agent processing.
	Run/schedule agents or review
	School
	Inactive
	School is retained but not currently active for operational processing.
	Reactivate when needed
	School
	Agents in Progress
	One or more agent/product jobs for the school are currently running.
	Monitor job(s)
	Product × School
	Not Run
	Selected data product/agent has not yet run for this school.
	Run agent
	Product × School
	Queued
	Run has been requested and is waiting for execution capacity.
	Wait / monitor
	Product × School
	In Progress
	Agent is currently processing this school/product.
	Monitor
	Product × School
	Completed
	Agent finished and output is available.
	Review output
	Product × School
	Needs Verification
	Output is available and awaiting human verification.
	Approve / reject / recrawl
	Product × School
	Verified
	Human verification completed successfully.
	Publish
	Product × School
	Rejected
	Output was rejected during review.
	Correct / re-crawl
	Product × School
	Re-crawl Requested
	Reviewer requested a fresh crawl for this school/product.
	Queue re-crawl
	Product × School
	Published
	Verified record has been promoted to AI-DOP production.
	Sync/export
	Job
	Pending
	Job is queued.
	Wait
	Job
	Running
	Job is executing.
	Monitor
	Job
	Completed
	Job completed successfully.
	Review results
	Job
	Failed
	Job failed.
	Inspect / retry
	7. Phase 1 Logical Data Model
The model should retain the broader specification's relational core while avoiding unnecessary Phase 1 intelligence entities. Product-shaped output can remain flexible through JSON/JSONB where appropriate.
Entity
	Key Fields
	Purpose
	Phase 1 Notes
	School
	school_id, name, website, address, district, state, validation_status
	Canonical school identity
	Stable ID required across AI-DOP and sandbox
	Batch
	batch_id, name, source_type, created_by, created_at, status
	Groups an intake set
	Example: San Antonio District
	BatchSchool
	batch_id, school_id
	Batch membership
	Allows one school to appear in multiple operational batches
	DataProduct
	product_id, name, agent_id, status, output_schema
	Product/agent registry
	Schema drives result display/export
	JobRequest
	request_id, batch_id, product_id, priority, created_by, created_at
	Operator/scheduled request
	One product per execution request
	Job
	job_id, request_id, agent_id, status, timestamps, metrics, error
	Execution instance
	Queue/worker managed
	AgentResult
	result_id, job_id, school_id, product_id, payload, status
	Agent output
	Raw result before verification
	Evidence
	evidence_id, result_id, source_url, source_type, extracted_content, crawl_timestamp, agent_id
	Provenance
	Immutable where returned
	Verification
	verification_id, school_id, product_id, result_id, decision, corrected_value, comment, reviewed_by, reviewed_at
	HITL record
	Product-specific
	PublishedRecord
	record_id, school_id, product_id, payload, version, published_at, published_by
	AI-DOP production record
	Upsert/versioned
	SandboxSync
	sync_id, record_id, target, status, attempts, response, synced_at
	Downstream integration log
	Retryable and idempotent
	Schedule
	schedule_id, batch_id, product_id, cadence, status, next_run, last_run
	Recurring execution
	Creates standard jobs/requests
	AuditLog
	audit_id, actor_id, action, entity, entity_id, timestamp, before, after
	Traceability
	Append-only
	8. Phase 1 Architecture
Recommended logical architecture:
* Upstream EC2 Data Pipeline → produces school dataset / school address information.
* AI-DOP Web UI → batch management, school library, agent selection, schedules, jobs, results, verification, publishing, sync.
* AI-DOP API/Application Services → authentication, schools, batches, products, jobs, review, publishing, exports, sandbox integration.
* Queue/Scheduler → controls execution timing and concurrency based on available worker/server capacity.
* Agent Orchestration Layer → dispatches the selected batch/product to the existing agent service and receives the result/callback.
* AI-DOP Database → stores schools, batches, jobs, results, evidence, verification, published records, and audit.
* SchoolPath Sandbox API → receives verified/published records using the same canonical schema and stable identifiers.
The existing specification recommends a React/TypeScript frontend, Node/NestJS or Express REST API, PostgreSQL/JSONB, Redis/BullMQ or equivalent asynchronous queue/scheduler, JWT/RBAC, object storage, and existing agents behind an Agent API. These can be treated as the reference implementation target rather than a mandatory technology decision. fileciteturn1file6L409-L430
School-level interaction requirement: Within a batch, users shall be able to search for a school by school name and other available identity fields. Selecting a school from the School Library shall open a school detail popup/modal showing all configured data-product agents for that school, including which products have run, which are currently in progress, which have completed, which are awaiting verification, which are verified, and which have been published. The popup is the primary school-level status view and shall allow navigation to the relevant result/review action.
9. Phase 1 UI Requirements
Screen
	Required Capability
	Purpose
	Dashboard
	Overall counts for batches, schools, jobs, review pending, verified, published, failed.
	Operational overview
	School Library
	Search/filter all schools; search within a selected batch; click a school to open the school popup; show school status and product summary.
	School-level operations
	Batch List
	Create/open/duplicate/archive batches; counts and status.
	Batch operations
	Create Batch
	Batch name + Excel upload + validation preview + confirm.
	Intake
	Batch Detail
	Show schools in batch, batch summary, product-by-product matrix, search within batch, and bulk action controls.
	Batch control center
	Agent / Product Registry
	List active/inactive products, assigned agent, schema, version.
	Configuration
	Run Agent
	Select batch + product + run now/schedule + priority.
	Execution
	Job Monitor
	Queue/running/completed/failed jobs; metrics; retry.
	Operations
	Results
	School/product result view with clickable URLs, evidence/source details, output-level comments, verification state, and export.
	Output and evidence
	Verification Queue
	Single-school, selected-school-group, batch, and agent/product-specific approve/reject/re-crawl; output-level comments; confirmation for bulk actions.
	HITL operations
	Published Data
	Verified/published records; product-level and batch-level publish controls; export and sandbox sync.
	Publishing
	Sandbox Sync
	Select verified/published records at school, group, product, or batch scope; sync status; retry failed syncs.
	Integration
	Schedules
	Recurring batch/product runs; pause/resume/run now.
	Automation
	Audit Log
	Searchable history of important actions.
	Traceability
	School Detail Popup / Modal: The popup shall include school identity (name, address, website), overall school status, current batch, and a product/agent matrix. Each product row shall show agent name, run status, last run time, completion status, verification status, publication status, and available actions (view output, verify, reject, re-crawl where permitted). URLs in the popup and linked result views must be clickable.
10. Minimum API Surface
Method
	Endpoint
	Purpose
	POST
	/api/auth/login
	Authenticate
	GET
	/api/schools
	Search/filter schools
	POST
	/api/schools/bulk
	Import Excel schools
	GET
	/api/batches
	List batches
	POST
	/api/batches
	Create batch
	GET
	/api/batches/:id
	Batch detail and status matrix
	GET
	/api/products
	List products/agents
	POST
	/api/jobs
	Create a batch/product run
	GET
	/api/jobs
	List/filter jobs
	GET
	/api/jobs/:id
	Job detail
	POST
	/api/jobs/:id/retry
	Retry failed job
	POST
	/api/agents/:agentId/run
	Internal agent dispatch
	POST
	/api/agents/callback
	Agent result/status callback
	GET
	/api/results
	List results
	GET
	/api/results/:id
	Result + evidence
	GET
	/api/review
	Verification queue
	POST
	/api/review/:id/approve
	Verify/approve
	POST
	/api/review/:id/correct
	Correct
	POST
	/api/review/:id/flag-recrawl
	Flag for re-crawl
	POST
	/api/publish
	Promote verified records to production
	GET
	/api/published/export
	Export published data
	POST
	/api/sandbox/sync
	Push verified/published records to sandbox
	GET
	/api/sandbox/sync/:id
	Sync result/status
	GET
	/api/schedules
	List schedules
	POST
	/api/schedules
	Create schedule
	PATCH
	/api/schedules/:id
	Pause/resume/edit
	POST
	/api/schedules/:id/run-now
	Run immediately
	GET
	/api/audit
	Audit log
	POST
	/api/jobs
	Create run for batch, selected school IDs, or selected school group + product/agent.
	POST
	/api/review/bulk
	Approve/reject/re-crawl for selected schools, batch, and/or product-specific output.
	POST
	/api/results/:id/comment
	Add comment to a specific output/result or field.
	GET
	/api/batches/:id/schools/search
	Search schools within a batch.
	GET
	/api/schools/:id/product-status
	Return all product/agent statuses for the school popup.
	11. Agent Integration Contract
The agent contract is the most important backend boundary in Phase 1. Agents are independently developed and deployed; AI-DOP should not depend on internal agent implementation details.
11.1 Input
* job_id
* agent_id / product_id
* school_ids[]
* product output schema/version
* optional execution metadata such as priority and requested timestamp
11.2 Output
* job_id
* status
* school_id
* product_id
* result payload
* evidence/source information where available
* crawl/extraction timestamp
* agent version
* error information where applicable
11.3 Contract Rules
* Agents do not write directly to AI-DOP published tables.
* Agent output is stored first as result/evidence data.
* Verification and publication are controlled by AI-DOP.
* The contract must be versioned.
* The UI should not need a custom screen for each agent; product schema determines the result layout.
This follows the existing specification's agent contract: each agent consumes a job containing a school set and product and emits evidence records; agents do not write directly to published datasets. fileciteturn1file2L134-L147
12. End-to-End Functional Workflow
#
	Stage
	Functional Behavior
	1
	Create Batch
	Admin creates a named batch such as “San Antonio District” and imports the initial school Excel file.
	2
	Validate Intake
	AI-DOP validates/records school identity and displays intake exceptions.
	3
	Select Product
	Admin opens the batch, selects a data product, and the platform resolves its assigned agent.
	4
	Run / Schedule
	Admin chooses Run Now or Schedule. The request enters the backend queue.
	5
	Execute Agent
	Worker dispatches the job to the existing agent. Job status is tracked.
	6
	Receive Results
	Agent returns results/evidence. AI-DOP persists them and marks product/schools Ready for Review.
	7
	Review
	Reviewer verifies/corrects/comments and can flag a school/product for re-crawl.
	8
	Publish
	Verified records are promoted to AI-DOP production DB.
	9
	Sync
	Admin triggers sandbox API sync. Records are upserted into the SchoolPath sandbox using the same canonical schema.
	10
	Operate Continuously
	Schedules, refreshes, verification, re-crawls, and retries continue as recurring operational work.
	13. Business Rules
Rule
	Statement
	BR-01
	A batch is a logical operational grouping of schools; it is not itself a data product.
	BR-02
	A run targets one batch and one data product/agent at a time.
	BR-03
	The same school can belong to multiple batches if operationally required.
	BR-04
	Product verification is independent. A school can be verified for one product and incomplete for another.
	BR-05
	Only verified records can be promoted to AI-DOP production.
	BR-06
	Only production-eligible verified records can be sent to the SchoolPath sandbox.
	BR-07
	Sandbox synchronization must be idempotent and upsert-based.
	BR-08
	Agent execution is asynchronous; UI responsiveness must not depend on an agent completing synchronously.
	BR-09
	Server-side queue controls actual concurrency. UI requests work but does not bypass capacity controls.
	BR-10
	Re-crawl flags must retain who flagged the item, when, why, and which school/product is affected.
	BR-11
	Agent output and evidence must remain distinguishable from human-verified data.
	BR-12
	Adding an agent/product should be possible through configuration/integration rather than a new hard-coded UI workflow.
	Additional Phase 1 rules: (1) Agent execution scope may be one school, a selected group of schools, or an entire batch. (2) Approve, reject, and re-crawl may be applied at school, selected-group, batch, or agent/product-output scope. (3) Bulk actions must never overwrite unrelated product outputs. (4) A comment can be attached to a specific output/result and must remain visible with that output. (5) All URLs displayed by AI-DOP must be clickable. (6) School Library must support search within a batch. (7) The school popup is a read/control surface for all configured product agents and their execution/verification/publication states.
14. Non-Functional Requirements
ID
	Category
	Requirement
	NFR-01
	Performance
	UI must remain responsive while jobs run asynchronously.
	NFR-02
	Scalability
	Architecture must support growth in schools, batches, products, and concurrent jobs.
	NFR-03
	Reliability
	Failed jobs and sandbox syncs must be retryable.
	NFR-04
	Idempotency
	Job submission, publishing, and sandbox sync must protect against duplicate records.
	NFR-05
	Security
	JWT/session authentication, RBAC, encrypted transport, and protected service-to-service APIs.
	NFR-06
	Auditability
	Important operational actions must be append-only/auditable.
	NFR-07
	Extensibility
	New data products/agents should be added without redesigning the platform.
	NFR-08
	Accessibility
	UI should target WCAG 2.1 AA: keyboard access, visible focus, readable contrast, accessible controls.
	NFR-09
	Observability
	Jobs and integrations should expose logs, timestamps, errors, and execution metrics.
	The broader specification also identifies scalability, security/RBAC, immutable audit, extensibility, determinism, and WCAG 2.1 AA as system-level requirements. Phase 1 carries forward the relevant operational requirements. fileciteturn2file0L103-L122
15. Phase 1 Acceptance Criteria
ID
	Acceptance Criterion
	AC-01
	Admin can create a named batch and import schools from Excel.
	AC-02
	Imported schools are visible in the School Library with operational status.
	AC-03
	Batch detail shows each school's product-level execution and verification status.
	AC-04
	Admin can select a batch + data product and run the assigned agent.
	AC-05
	Jobs enter Pending/Running/Completed/Failed states and are visible in Job Monitor.
	AC-06
	Agent results are stored and viewable in UI with available evidence/source information.
	AC-07
	Reviewer can verify, correct where supported, add comments, and flag re-crawl.
	AC-08
	Verification status is tracked independently per school and product.
	AC-09
	Verified records can be promoted to AI-DOP production.
	AC-10
	Published records can be exported to Excel/CSV.
	AC-11
	Admin can sync verified/published records to SchoolPath sandbox via API.
	AC-12
	Sandbox uses the same canonical schema and stable IDs for clean upsert.
	AC-13
	Failed agent and sandbox jobs can be retried without duplicate published/sandbox records.
	AC-14
	Recurring schedules can be created, paused/resumed, and run immediately.
	AC-15
	Adding another agent/product does not require creating a new hard-coded UI workflow.
	AC-16
	Unauthorized users cannot perform restricted operations.
	Enhanced acceptance checks: An operator can run one agent against one school, a selected group, or the full batch; bulk approve/reject/re-crawl works for one school, a selected group, or a batch and can be restricted to a selected agent/product; every displayed source URL is clickable; comments can be attached to individual outputs; batch search finds a school without leaving the batch; and the School Library popup shows every configured agent/product plus what has run, what is in progress, what has finished, what is awaiting verification, and what is published.
16. Recommended Development Sequence
1. Foundation: database schema, authentication, RBAC, audit framework.
2. School Library + Excel intake: schools, validation, batch creation/import.
3. Product/Agent Registry: configurable product-agent mapping and output schema.
4. Job Orchestration: requests, queue, workers, agent dispatch/callback, job monitor.
5. Results + Evidence: result storage, provenance, result UI, exports.
6. Verification: queue, approval/correction/comment, re-crawl flags, product-level statuses.
7. Publishing: verified-record promotion to AI-DOP production with version/upsert rules.
8. Sandbox Integration: canonical schema alignment, API sync, retry/idempotency, sync monitor.
9. Scheduling: recurring jobs, pause/resume, capacity controls, notifications.
10. Hardening: accessibility, security, observability, performance, audit, regression testing.
This sequence is a Phase 1-specific simplification of the source specification's broader build sequence, which starts with data model/auth, school intake, products/agent contract, requests/jobs, review/publishing, and then later intelligence, learning, and advanced frontend surfaces. fileciteturn2file1L224-L245
17. Developer Design Notes
* Keep the frontend thin: business rules, permissions, job state transitions, publishing rules, and integration controls must be enforced by APIs.
* Use stable identifiers for school_id, product_id, batch_id, job_id, result_id, and published record versions.
* Treat product schemas as configuration so the UI can render different agent outputs without custom pages.
* Do not tightly couple AI-DOP to an agent's internal codebase or deployment method. GitHub-based agent deployment remains independent.
* Use asynchronous processing. The UI should poll, stream, or subscribe to status updates rather than waiting on long-running requests.
* Design the batch/product matrix as a first-class UI pattern because it is the operator's main control surface.
* Preserve provenance from result → evidence/source → verification → publication → sandbox sync.
* Keep the canonical data contract shared between AI-DOP production and SchoolPath sandbox to simplify transfer and upsert.
* Build extension points for future pipeline ingestion rather than implementing the upstream crawler inside AI-DOP.
18. Traceability to Existing AI-DOP Specification
Area
	Source Specification
	Phase 1 Treatment
	School intake
	Existing operational module
	Retained and narrowed to Phase 1 batch intake/status.
	Data products + agents
	Existing configurable product model
	Retained; expanded to approximately ten existing agents.
	Requests/jobs
	Existing orchestration model
	Retained; batch becomes the primary operator grouping.
	Evidence/review/publishing
	Existing HITL model
	Retained; Phase 1 simplifies the review UI.
	Schedules
	Existing recurring schedule model
	Retained as basic automation.
	ERCIE
	Existing intelligence layer
	Advanced intelligence UI deferred; result/evidence storage remains compatible.
	Learning
	Existing Phase 3 concept
	Deferred from Phase 1.
	Intelligence surfaces/Copilot
	Existing frontend scope
	Deferred from Phase 1.
	19. Assumptions and Open Design Decisions
* The exact list of approximately ten agents and their final product schemas will be supplied by the engineering/product team.
* The upstream EC2 pipeline will expose a usable file/API/event interface for future automated intake; Phase 1 only requires Excel.
* The agent services can accept a batch-derived list of school IDs and return a stable job/result response.
* The exact canonical SchoolPath sandbox schema/API contract must be finalized jointly with the SchoolPath application team before implementation.
* The queue concurrency limit should be configurable rather than hard-coded so it can be tuned to EC2/worker capacity.
* The final decision on whether verification is required for every product or only selected products should be configurable at product level.
* The HTML output can initially be a browser-readable result page; a formal report generator is not required for Phase 1.
20. Phase 1 Definition of Done
Phase 1 is complete when an operator can take an incoming school dataset, create a named batch, select any configured data-product agent, run it now or through the scheduler, monitor the queued/running/completed job, inspect school-level results and evidence, verify and comment on results, flag re-crawls, publish verified product records to AI-DOP production, and push those verified records to the SchoolPath sandbox through an idempotent API using the same canonical schema. The platform must support this workflow for approximately ten agents without requiring a separate custom UI implementation for each agent.


End of Phase 1 FRD
Confidential — Phase 1 Functional Requirements Document

