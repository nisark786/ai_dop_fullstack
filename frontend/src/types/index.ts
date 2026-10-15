/**
 * SchoolPath AI-DOP (AI Data Operations Platform)
 * Authoritative TypeScript Domain Models
 * Derived directly from System Spec Section 5.1 & Section 13-21
 */

export type UserRole = 'Admin' | 'Reviewer' | 'Viewer';

export type ValidationStatus = 'Verified' | 'Needs Review' | 'Invalid' | 'Unverified';

export interface School {
  id: string;
  name: string;
  website?: string | null;
  url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  district?: string | null;
  school_type?: string | null;
  type?: string[];
  grades?: string[];
  is_active: boolean;
  profile_verification_status?: string | null;
  profile_verified_at?: string | null;
  rating?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Legacy UI compatibility
  validation_status?: ValidationStatus;
  validation_reason?: string;
}

export interface SchoolStats {
  total_schools: number;
  active_schools: number;
  inactive_schools: number;
  verified_schools: number;
  pending_schools: number;
}

export interface PaginatedSchoolsResponse {
  items: School[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SchoolCreateInput {
  name: string;
  website?: string | null;
  url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  type?: string[];
  grades?: string[];
  is_active?: boolean;
  profile_verification_status?: string;
}

export interface BatchAuditStatus {
  is_running: boolean;
  total: number;
  processed: number;
  reactivated: number;
  needs_review: number;
  unverified: number;
  current_school_name: string | null;
  elapsed_seconds: number;
  progress_percent: number;
  logs: string[];
}

export interface DataProduct {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  agent_id: string;
  output_schema: Record<string, string>;
}

export type DecisionBand = 'Auto Publish' | 'Reviewer Approval' | 'Mandatory HITL Review' | 'Escalation Required';

export interface ConfidenceComponents {
  support_strength: number;       // 40% weight
  source_agreement: number;       // 30% weight
  freshness: number;              // 20% weight
  historical_consistency: number; // 10% weight
}

export interface EvidenceCandidate {
  id?: string;
  school_id?: string;
  product?: string;
  field_name?: string;
  field_value?: string;
  source_name: string;
  source_type: string;
  source_category: 'Cat 1 — Official School' | 'Cat 2 — Official Social' | 'Cat 3 — External' | string;
  source_url?: string;
  provenance_url?: string;
  citation_url?: string;
  raw_extracted_text?: string;
  crawl_timestamp: string;
  agent_id?: string;
  trust_weight?: number;
  historical_accuracy?: number;
  confidence_score?: number;
  extracted_value?: string;
  source_score: number;
}

export interface ValueGroup {
  value: string;
  supporting_sources?: string[];
  sources?: string[];
  evidence_support?: number;
  total_support?: number;
  source_count?: number;
  is_winner?: boolean;
}

export interface ResolvedValue {
  id: string;
  school_id: string;
  school_name: string;
  product?: string;
  product_name?: string;
  field_name: string;
  previous_value?: string | null;
  winning_value: string;
  total_support: number;
  agreement_pct?: number;
  agreement_percentage?: number;
  confidence: number;
  dqa_score?: number | null;
  confidence_components: ConfidenceComponents;
  decision?: DecisionBand;
  decision_band?: string;
  has_conflict: boolean;
  version?: string;
  value_groups?: ValueGroup[];
  evidence_candidates?: EvidenceCandidate[];
  candidates?: EvidenceCandidate[];
  review_status?: 'pending' | 'approved' | 'corrected' | 'rejected' | string;
  final_value?: string | null;
  reviewer_comment?: string | null;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface CrawlJob {
  id: string;
  request_id: string;
  agent_id: 'MetadataAgent' | string;
  product_name: string;
  status: 'Pending' | 'Running' | 'Paused' | 'Cancelled' | 'Completed' | 'Failed' | string;
  schools_processed: number;
  records_extracted: number;
  exec_time_seconds?: number;
  execution_time_seconds?: number;
  error_reason?: string;
  created_at?: string;
}

export interface SourceRegistryItem {
  id: string;
  source_name: string;
  category: string;
  configured_weight: number;
  effective_weight: number;
  approved_ct: number;
  corrected_ct: number;
  rejected_ct: number;
  total_reviews: number;
  historical_accuracy: number;
}

export interface PromptTemplate {
  id: string;
  product_id?: string;
  product_name?: string;
  field_name?: string;
  version: string;
  body?: string;
  prompt_text?: string;
  active?: boolean;
  is_active?: boolean;
  accuracy?: number;
  approval_rate: number;
  correction_rate: number;
  rejection_rate?: number;
  total_evaluations?: number;
  updated_at?: string;
}

export interface PublishedRecord {
  id: string;
  school_id: string;
  staging_school_id?: string | null;
  school_name: string;
  district?: string;
  product: string;
  field_name?: string;
  published_value?: string;
  verified_value?: string;
  confidence?: number;
  confidence_score?: number;
  academic_year?: string;
  version?: string;
  published_at: string;
  published_by?: string;
  sandbox_sync?: SandboxSyncInfo | null;
}

// --- BATCH INTAKE & MANAGEMENT (FR-3) ---

export interface DuplicateMatchInfo {
  existing_school_id: string;
  existing_school_name: string;
  existing_website: string | null;
  match_type: string;
  confidence_score: number;
}

export interface IntakeRowPreview {
  row_number: number;
  name: string;
  website: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  phone?: string | null;
  email?: string | null;
  type?: string[] | null;
  grades?: string[] | null;
  is_valid: boolean;
  validation_errors: string[];
  potential_duplicate: DuplicateMatchInfo | null;
  selected_action: string;
}

export interface BatchUploadPreviewResponse {
  filename: string;
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  duplicates_count: number;
  rows: IntakeRowPreview[];
}

export interface BatchConfirmRow {
  name: string;
  website: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  phone?: string | null;
  email?: string | null;
  type?: string[] | null;
  grades?: string[] | null;
  action: string;
  link_school_id: string | null;
}

export interface BatchConfirmCreateRequest {
  name: string;
  description: string | null;
  source_type: string;
  rows: BatchConfirmRow[];
}

export interface BatchUpdateRequest {
  name: string;
  description?: string | null;
}

export interface AddBatchSchoolRequest {
  school_id?: string;
  name?: string;
  website?: string | null;
  address?: string | null;
  district?: string | null;
  state?: string | null;
}

export interface BatchSummaryItem {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  status: string;
  school_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  days_remaining?: number | null;
}

export interface SchoolTrashItem {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  type?: string[];
  grades?: string[];
  deleted_at: string;
  days_remaining: number;
}

export interface MetadataRecommendationSource {
  url: string;
  page?: string | null;
  text: string;
  trust_score: number;
}

export interface MetadataRecommendation {
  field: string;
  current?: any;
  recommended?: any;
  confidence: number;
  reason: string;
  sources: MetadataRecommendationSource[];
}

export interface ProductInfoStatus {
  status: 'not_run' | 'queued' | 'running' | 'verified' | 'needs_review' | string;
  score?: number;
  job_id?: string;
  updated_at?: string;
  completed_at?: string;
  started_at?: string;
  recommendations?: MetadataRecommendation[];
  error?: string;
}

export interface RunMetadataAgentRequest {
  scope: 'single' | 'group' | 'whole_batch';
  school_ids?: string[];
  priority?: 'low' | 'normal' | 'high';
  force_refresh?: boolean;
  workers?: number;
}

export interface AgentDispatchResponse {
  job_id: string;
  batch_id: string;
  agent_id: string;
  product_name: string;
  target_count: number;
  status: string;
  message: string;
}

export interface JobActionResponse {
  job_id: string;
  batch_id?: string;
  status: string;
  message: string;
}

export interface BatchDetailSchoolItem {
  school_id: string;
  name: string;
  website: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  status: string;
  added_at: string;
  products?: Record<string, ProductInfoStatus>;
}

export interface ProductProgressItem {
  product_id: string;
  product_name: string;
  unprocessed_count: number;
  processing_count: number;
  verified_count: number;
  failed_count: number;
}

export interface BatchDetailResponse {
  batch: BatchSummaryItem;
  schools: BatchDetailSchoolItem[];
  product_matrix: ProductProgressItem[];
}

export interface BulkDropSchoolsResponse {
  message: string;
  batch_id: string;
  dropped_count: number;
  remaining_schools: number;
}

export interface AgentRegistryItem {
  product_key: string;
  product_name: string;
  agent_id: string;
  agent_name: string;
  version: string;
  status: 'active' | 'coming_soon';
  is_implemented: boolean;
  description: string;
  target_fields: string[];
  model_name: string;
  dispatch_endpoint: string | null;
}

export interface RunAgentsForBatchRequest {
  batch_ids: string[];
  batch_id?: string;
  agent_keys: string[];
  scope?: 'batch' | 'group' | 'single';
  school_ids?: string[];
  priority?: 'normal' | 'high' | 'low';
  force_refresh?: boolean;
  workers?: number;
}

export interface RunAgentsForBatchResponse {
  dispatched: AgentDispatchResponse[];
  skipped: string[];
  message: string;
}

export interface AgentJobSummary {
  job_id: string;
  batch_id: string;
  product_key: string;
  product_name: string;
  agent_id: string;
  status: 'pending' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed';
  target_count: number;
  completed_count: number;
  failed_count: number;
  started_at: string | null;
  finished_at: string | null;
  elapsed_seconds: number | null;
  error: string | null;
}

// --- OPENAI COST & TOKEN MONITORING ---

export interface AgentCostBreakdown {
  agent_name: string;
  total_cost_usd: number;
  total_calls: number;
  total_tokens: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  avg_duration_ms?: number;
}

export interface CostSummary {
  total_cost_usd: number;
  total_calls: number;
  total_tokens: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  avg_cost_per_call_usd: number;
  avg_duration_ms?: number;
  agent_breakdown: AgentCostBreakdown[];
  period_label: string;
}

export interface CostLogEntry {
  id: string;
  agent_name: string;
  school_id: string | null;
  batch_id: string | null;
  batch_name?: string | null;
  school_name?: string | null;
  task_name: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  duration_ms: number;
  logged_at: string;
}

export interface CostInvocationsResponse {
  items: CostLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

// --- BATCH PIPELINE RUNS & EXPORT (FR-7) ---

export interface BatchRunSummary {
  job_id: string;
  batch_id: string | null;
  batch_name: string;
  agent_name: string;
  agent_version: string;
  total_schools: number;
  verified_count: number;
  needs_review_count: number;
  avg_score: number;
  cache_hits_total: number;
  status: 'completed' | 'running' | 'failed' | string;
  created_at: string;
}

export interface SchoolRunOutputItem {
  school_id: string;
  school_name: string;
  website: string | null;
  address: string | null;
  overall_score: number;
  verification_status: 'verified' | 'needs_review' | 'invalid' | string;
  extracted_fields: Record<string, any>;
  recommendations: Array<{
    field: string;
    current: any;
    recommended: any;
    confidence: number;
  }>;
  pages_crawled_count: number;
  cache_hits_count: number;
  applied_to_school: boolean;
  crawled_at: string;
}

export interface BatchRunDetailResponse {
  summary: BatchRunSummary;
  schools: SchoolRunOutputItem[];
}

// --- RESULTS VIEW (RECORD-BY-RECORD CRAWLED OUTPUT) ---

export interface ResultSchoolItem {
  id: string;
  school_id: string;
  school_name: string;
  district: string | null;
  batch_id: string | null;
  batch_name: string | null;
  product_key: string;
  product_name: string;
  value1_label?: string;
  value1_value?: string;
  value2_label?: string;
  value2_value?: string;
  value3_label?: string;
  value3_value?: string;
  website?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  grades?: string[];
  school_type?: string[];
  description?: string | null;
  open_enrollment?: boolean | null;
  open_enrollment_grades?: string[];
  base_tuition?: string | null;
  teaching_style?: string | null;
  learning_models?: string[];
  extracurricular_programs?: string[];
  post_ingestion_record?: Record<string, any>;
  status: 'Published' | 'Verified' | 'Needs Verification' | 'Completed' | string;
  crawled_at: string;
  overall_score: number | null;
  evidence_count: number;
  extracted_fields: Record<string, any>;
  recommendations: Array<{
    field: string;
    current?: any;
    recommended?: any;
    confidence?: number;
    reason?: string;
    sources?: Array<{
      url?: string;
      page?: string;
      text?: string;
      trust_score?: number;
    }>;
  }>;
  is_promoted: boolean;
}

export interface ResultsSummary {
  total_records: number;
  published_count: number;
  verified_count: number;
  needs_verification_count: number;
  completed_count: number;
}

export interface ResultsListResponse {
  records: ResultSchoolItem[];
  summary: ResultsSummary;
  selected_batch_id: string | null;
  selected_product_key: string;
}

export interface ReviewEvidenceItem {
  id: string;
  field_name: string;
  source_name: string;
  source_type: string;
  source_url: string;
  snippet?: string | null;
  extracted_value: string;
  confidence_score: number;
  extracted_at?: string | null;
}

export interface SandboxSyncInfo {
  status: 'synced' | 'failed' | 'disabled';
  sandbox_id?: string | null;
  synced_at?: string | null;
  message?: string | null;
  error?: string | null;
}

export interface VerificationSchoolItem {
  id: string;
  batch_id: string;
  batch_name: string;
  name: string;
  website?: string | null;
  district?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: string[];
  grades: string[];
  status: string;
  dqa_score?: number | null;
  confidence_score?: number | null;
  evidence_count: number;
  extracted_fields: Record<string, any>;
  recommendations: Array<{
    field: string;
    current?: any;
    recommended?: any;
    confidence?: number;
    reason?: string;
  }>;
  evidences: ReviewEvidenceItem[];
  is_published?: boolean;
  production_school_id?: string | null;
  updated_at?: string | null;
  sandbox_sync?: SandboxSyncInfo | null;
}

export interface BulkReviewActionRequest {
  school_ids: string[];
  batch_id?: string | null;
  product?: string;
  scope: 'single' | 'group' | 'batch';
  action: 'approve' | 'reject' | 'undo' | 'publish';
  reason?: string | null;
}

export interface BulkReviewActionResponse {
  action: 'approve' | 'reject' | 'undo' | 'publish';
  affected_count: number;
  message: string;
  updated_school_ids: string[];
}



