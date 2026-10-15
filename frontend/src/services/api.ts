/**
 * SchoolPath AI-DOP API Service Layer
 * Fully connected to the live FastAPI backend via centralized Axios client.
 */

import { apiClient, API_BASE_URL } from './client';
import { saveBlobAsFile } from '../utils/download';
import type {
  School,
  SchoolCreateInput,
  SchoolStats,
  SchoolTrashItem,
  PaginatedSchoolsResponse,
  ResolvedValue,
  CrawlJob,
  PublishedRecord,
  SourceRegistryItem,
  PromptTemplate,
  BatchSummaryItem,
  BatchDetailResponse,
  BatchConfirmCreateRequest,
  BulkDropSchoolsResponse,
  BatchUpdateRequest,
  AddBatchSchoolRequest,
  RunMetadataAgentRequest,
  AgentDispatchResponse,
  AgentRegistryItem,
  RunAgentsForBatchRequest,
  RunAgentsForBatchResponse,
  AgentJobSummary,
  JobActionResponse,
  BatchAuditStatus,
  CostSummary,
  CostInvocationsResponse,
  BatchRunSummary,
  BatchRunDetailResponse,
  ResultsListResponse,
  VerificationSchoolItem,
  BulkReviewActionRequest,
  BulkReviewActionResponse,
  SandboxSyncInfo,
} from '../types';

export { API_BASE_URL };

export interface AuditRecommendation {
  field: string;
  current: unknown;
  recommended: unknown;
  confidence: number;
  reason: string;
  sources: { url: string; text: string; trust_score?: number }[];
}

export interface AuditReport {
  school_id: string;
  school_name?: string;
  overall_score: number;
  status_changed_to?: string;
  recommendations: AuditRecommendation[];
}

export const api = {
  // --- Schools ---
  async getSchoolStats(): Promise<SchoolStats> {
    const res = await apiClient.get<SchoolStats>('/schools/stats');
    return res.data;
  },

  async getSchools(params?: {
    status?: string;
    verification_status?: string;
    search?: string;
    limit?: number;
    skip?: number;
    page?: number;
    page_size?: number;
  }): Promise<School[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.status && params.status !== 'all') queryParams.status = params.status;
    if (params?.verification_status && params.verification_status !== 'all') queryParams.verification_status = params.verification_status;
    if (params?.search) queryParams.search = params.search;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.skip) queryParams.skip = params.skip;
    
    const pageSize = params?.page_size || params?.limit || 50;
    const page = params?.page || (params?.skip !== undefined ? Math.floor(params.skip / pageSize) + 1 : 1);
    queryParams.page = page;
    queryParams.page_size = pageSize;

    const res = await apiClient.get<School[] | { items: School[] }>('/schools', { params: queryParams });
    return Array.isArray(res.data) ? res.data : (res.data.items || []);
  },

  async getPaginatedSchools(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    verification_status?: string;
    school_type?: string;
    missing_website?: boolean;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedSchoolsResponse> {
    const queryParams: Record<string, string | number | boolean> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.page_size) queryParams.page_size = params.page_size;
    if (params?.status && params.status !== 'all') queryParams.status = params.status;
    if (params?.verification_status && params.verification_status !== 'all') queryParams.verification_status = params.verification_status;
    if (params?.school_type && params.school_type !== 'all') queryParams.school_type = params.school_type;
    if (params?.missing_website !== undefined && params.missing_website !== null) queryParams.missing_website = params.missing_website;
    if (params?.search) queryParams.search = params.search;
    if (params?.sort_by) queryParams.sort_by = params.sort_by;
    if (params?.sort_order) queryParams.sort_order = params.sort_order;

    const res = await apiClient.get<PaginatedSchoolsResponse>('/schools', { params: queryParams });
    return res.data;
  },

  async updateSchool(schoolId: string, updates: Partial<School>): Promise<School> {
    const res = await apiClient.patch<School>(`/schools/${encodeURIComponent(schoolId)}`, updates);
    return res.data;
  },

  async createSchool(school: SchoolCreateInput): Promise<School> {
    const res = await apiClient.post<School>('/schools', school);
    return res.data;
  },

  async deleteSchool(schoolId: string): Promise<{ school_id: string; message: string; status: string }> {
    const res = await apiClient.delete<{ school_id: string; message: string; status: string }>(`/schools/${encodeURIComponent(schoolId)}`);
    return res.data;
  },

  async getTrashSchools(params?: { search?: string; limit?: number; offset?: number }): Promise<SchoolTrashItem[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get<SchoolTrashItem[]>('/schools/trash', { params: queryParams });
    return res.data;
  },

  async restoreSchool(schoolId: string): Promise<{ school_id: string; message: string; status: string }> {
    const res = await apiClient.post<{ school_id: string; message: string; status: string }>(`/schools/${encodeURIComponent(schoolId)}/restore`);
    return res.data;
  },

  async permanentDeleteSchool(schoolId: string): Promise<{ school_id: string; message: string; status: string }> {
    const res = await apiClient.delete<{ school_id: string; message: string; status: string }>(`/schools/${encodeURIComponent(schoolId)}/permanent`);
    return res.data;
  },

  async purgeExpiredSchools(retentionDays: number = 30): Promise<{ purged_count: number; message: string }> {
    const res = await apiClient.post<{ purged_count: number; message: string }>('/schools/trash/purge-expired', null, {
      params: { retention_days: retentionDays },
    });
    return res.data;
  },

  // --- Crawl Jobs ---
  async getJobs(): Promise<CrawlJob[]> {
    const res = await apiClient.get<CrawlJob[]>('/jobs');
    return res.data;
  },

  async startJob(agentId: string = 'MetadataAgent', productName: string = 'School Profile & Metadata'): Promise<any> {
    const res = await apiClient.post('/jobs/start', null, {
      params: { agent_id: agentId, product_name: productName },
    });
    return res.data;
  },

  async retryJob(jobId: string): Promise<any> {
    const res = await apiClient.post(`/jobs/${encodeURIComponent(jobId)}/retry`);
    return res.data;
  },

  // --- Review Queue (ERCIE) ---
  async getReviewQueue(): Promise<ResolvedValue[]> {
    const res = await apiClient.get<ResolvedValue[]>('/review');
    return res.data;
  },

  async approveReview(id: string): Promise<any> {
    const res = await apiClient.post(`/review/${encodeURIComponent(id)}/approve`);
    return res.data;
  },

  async correctReview(id: string, correctedValue: string): Promise<any> {
    const res = await apiClient.post(`/review/${encodeURIComponent(id)}/correct`, {
      corrected_value: correctedValue,
    });
    return res.data;
  },

  async rejectReview(id: string): Promise<any> {
    const res = await apiClient.post(`/review/${encodeURIComponent(id)}/reject`);
    return res.data;
  },

  async getReviewSchools(params?: {
    batch_id?: string;
    product?: string;
    queue_type?: 'verification' | 'approved' | 'recrawl';
    search?: string;
  }): Promise<VerificationSchoolItem[]> {
    const queryParams: Record<string, string> = {};
    if (params?.batch_id && params.batch_id !== 'all') queryParams.batch_id = params.batch_id;
    if (params?.product) queryParams.product = params.product;
    if (params?.queue_type) queryParams.queue_type = params.queue_type;
    if (params?.search) queryParams.search = params.search;
    const res = await apiClient.get<VerificationSchoolItem[]>('/review/schools', { params: queryParams });
    return res.data;
  },

  async executeReviewAction(payload: BulkReviewActionRequest): Promise<BulkReviewActionResponse> {
    const res = await apiClient.post<BulkReviewActionResponse>('/review/bulk-action', payload);
    return res.data;
  },

  async retrySandboxSync(schoolId: string): Promise<SandboxSyncInfo> {
    const res = await apiClient.post<SandboxSyncInfo>(
      `/review/schools/${encodeURIComponent(schoolId)}/retry-sandbox-sync`
    );
    return res.data;
  },

  // --- Sources & Ranking ---
  async getSources(): Promise<SourceRegistryItem[]> {
    const res = await apiClient.get<SourceRegistryItem[]>('/sources');
    return res.data;
  },

  async updateSourceWeight(id: string, newWeight: number): Promise<any> {
    const res = await apiClient.patch(`/sources/${encodeURIComponent(id)}/weight`, {
      new_weight: newWeight,
    });
    return res.data;
  },

  // --- Published Data ---
  async getPublishedData(): Promise<PublishedRecord[]> {
    const res = await apiClient.get<PublishedRecord[]>('/published');
    return res.data;
  },

  // --- Prompts ---
  async getPrompts(): Promise<PromptTemplate[]> {
    const res = await apiClient.get<PromptTemplate[]>('/prompts');
    return res.data;
  },

  // --- DQA Audit Pipeline ---
  async runSchoolAudit(schoolId: string): Promise<AuditReport> {
    const res = await apiClient.post<AuditReport>(`/pipelines/audit/run/${encodeURIComponent(schoolId)}`);
    return res.data;
  },

  async getBatchAuditStatus(): Promise<BatchAuditStatus> {
    const res = await apiClient.get<BatchAuditStatus>('/pipelines/audit/status');
    return res.data;
  },

  async startBatchAudit(limit: number = 10): Promise<{ message: string; queued_count: number; schools?: any[] }> {
    const res = await apiClient.post('/pipelines/audit/run-batch', null, {
      params: { limit },
    });
    return res.data;
  },

  async runBatchAudit(): Promise<{ message: string; target_school_ids?: string[] }> {
    const res = await apiClient.post('/pipelines/audit/run-batch', null, {
      params: { limit: 10 },
    });
    return res.data;
  },

  // --- Batches (FR-3) ---
  async getBatches(params?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<BatchSummaryItem[]> {
    const queryParams: Record<string, string | number> = {};
    if (params?.status && params.status !== 'All') queryParams.status = params.status;
    if (params?.search) queryParams.search = params.search;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get<BatchSummaryItem[]>('/batches', { params: queryParams });
    return res.data;
  },

  async getBatchDetail(id: string): Promise<BatchDetailResponse> {
    const res = await apiClient.get<BatchDetailResponse>(`/batches/${encodeURIComponent(id)}`);
    return res.data;
  },

  async previewBatchUpload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/batches/upload-preview', formData);
    return res.data;
  },

  async confirmBatchUpload(payload: BatchConfirmCreateRequest) {
    const res = await apiClient.post('/batches/upload-confirm', payload);
    return res.data;
  },

  async getTrashBatches(params?: { search?: string; limit?: number; offset?: number }) {
    const queryParams: Record<string, string | number> = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get('/batches/trash', { params: queryParams });
    return res.data;
  },

  async updateBatch(id: string, payload: BatchUpdateRequest) {
    const res = await apiClient.patch(`/batches/${encodeURIComponent(id)}`, payload);
    return res.data;
  },

  async deleteBatch(id: string) {
    const res = await apiClient.delete(`/batches/${encodeURIComponent(id)}`);
    return res.data;
  },

  async restoreBatch(id: string) {
    const res = await apiClient.post(`/batches/${encodeURIComponent(id)}/restore`);
    return res.data;
  },

  async permanentDeleteBatch(id: string) {
    const res = await apiClient.delete(`/batches/${encodeURIComponent(id)}/permanent`);
    return res.data;
  },

  async addSchoolToBatch(batchId: string, payload: AddBatchSchoolRequest) {
    const res = await apiClient.post(`/batches/${encodeURIComponent(batchId)}/schools`, payload);
    return res.data;
  },

  async dropSchoolFromBatch(batchId: string, schoolId: string) {
    const res = await apiClient.delete(`/batches/${encodeURIComponent(batchId)}/schools/${encodeURIComponent(schoolId)}`);
    return res.data;
  },

  async bulkDropSchoolsFromBatch(batchId: string, schoolIds: string[]): Promise<BulkDropSchoolsResponse> {
    const res = await apiClient.post<BulkDropSchoolsResponse>(
      `/batches/${encodeURIComponent(batchId)}/schools/bulk-drop`,
      { school_ids: schoolIds }
    );
    return res.data;
  },

  async purgeExpiredTrash(retentionDays: number = 30) {
    const res = await apiClient.post('/batches/trash/purge-expired', null, {
      params: { retention_days: retentionDays },
    });
    return res.data;
  },

  async runMetadataAgent(batchId: string, payload: RunMetadataAgentRequest): Promise<AgentDispatchResponse> {
    const res = await apiClient.post<AgentDispatchResponse>(`/batches/${encodeURIComponent(batchId)}/run-metadata-agent`, payload);
    return res.data;
  },

  // --- AI Agents Operations ---
  async fetchAgentRegistry(): Promise<AgentRegistryItem[]> {
    const res = await apiClient.get<AgentRegistryItem[]>('/agents/registry');
    return res.data;
  },

  async runAgentsForBatch(payload: RunAgentsForBatchRequest): Promise<RunAgentsForBatchResponse> {
    const res = await apiClient.post<RunAgentsForBatchResponse>('/agents/run-for-batch', payload);
    return res.data;
  },

  async fetchAgentJobs(batchIds?: string[] | string, status?: string): Promise<AgentJobSummary[]> {
    const params = new URLSearchParams();
    if (batchIds) {
      if (Array.isArray(batchIds)) {
        batchIds.forEach((bId) => params.append('batch_ids', bId));
      } else {
        params.append('batch_ids', batchIds);
      }
    }
    if (status) params.append('status', status);

    const res = await apiClient.get<AgentJobSummary[]>('/agents/jobs', { params });
    return res.data;
  },

  async pauseJob(jobId: string, batchId?: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(
      `/agents/jobs/${encodeURIComponent(jobId)}/pause`,
      null,
      { params: batchId ? { batch_id: batchId } : undefined }
    );
    return res.data;
  },

  async resumeJob(jobId: string, workers?: number, batchId?: string): Promise<JobActionResponse> {
    const params: Record<string, any> = {};
    if (workers) params.workers = workers;
    if (batchId) params.batch_id = batchId;
    const res = await apiClient.post<JobActionResponse>(
      `/agents/jobs/${encodeURIComponent(jobId)}/resume`,
      null,
      { params: Object.keys(params).length > 0 ? params : undefined }
    );
    return res.data;
  },

  async cancelJob(jobId: string, batchId?: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(
      `/agents/jobs/${encodeURIComponent(jobId)}/cancel`,
      null,
      { params: batchId ? { batch_id: batchId } : undefined }
    );
    return res.data;
  },

  getTemplateDownloadUrl(): string {
    return `${API_BASE_URL}/batches/template`;
  },

  // --- OpenAI Cost & Token Monitoring ---
  async getCostSummary(days: number = 7): Promise<CostSummary> {
    const res = await apiClient.get<CostSummary>('/costs/summary', {
      params: { days },
    });
    return res.data;
  },

  async getCostInvocations(params?: {
    page?: number;
    page_size?: number;
    agent_name?: string;
    batch_id?: string;
  }): Promise<CostInvocationsResponse> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.page_size) queryParams.page_size = params.page_size;
    if (params?.agent_name) queryParams.agent_name = params.agent_name;
    if (params?.batch_id) queryParams.batch_id = params.batch_id;

    const res = await apiClient.get<CostInvocationsResponse>('/costs/invocations', { params: queryParams });
    return res.data;
  },

  async downloadCostLogsCsv(
    params?: {
      days?: number;
      agent_name?: string;
      batch_id?: string;
    },
    filename: string = `openai_cost_audit_${new Date().toISOString().slice(0, 10)}.csv`
  ): Promise<void> {
    const queryParams: Record<string, string | number> = {};
    if (params?.days) queryParams.days = params.days;
    if (params?.agent_name) queryParams.agent_name = params.agent_name;
    if (params?.batch_id) queryParams.batch_id = params.batch_id;

    const res = await apiClient.get('/costs/export', {
      params: queryParams,
      responseType: 'blob',
    });
    saveBlobAsFile(new Blob([res.data], { type: 'text/csv' }), filename);
  },

  // --- Pipeline Batch Runs & Exports ---
  async getBatchRuns(): Promise<BatchRunSummary[]> {
    const res = await apiClient.get<BatchRunSummary[]>('/runs');
    return res.data;
  },

  async getBatchRunDetail(jobId: string): Promise<BatchRunDetailResponse> {
    const res = await apiClient.get<BatchRunDetailResponse>(`/runs/${encodeURIComponent(jobId)}`);
    return res.data;
  },

  async downloadRunHtml(jobId: string, filename: string = `report-${jobId}.html`): Promise<void> {
    const res = await apiClient.get(`/runs/${encodeURIComponent(jobId)}/export/html`, {
      responseType: 'blob',
    });
    saveBlobAsFile(new Blob([res.data], { type: 'text/html' }), filename);
  },

  async downloadRunExcel(jobId: string, filename: string = `run-${jobId}.xlsx`): Promise<void> {
    const res = await apiClient.get(`/runs/${encodeURIComponent(jobId)}/export/excel`, {
      responseType: 'blob',
    });
    saveBlobAsFile(
      new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename
    );
  },

  async downloadRunCsv(jobId: string, filename: string = `run-${jobId}.csv`): Promise<void> {
    const res = await apiClient.get(`/runs/${encodeURIComponent(jobId)}/export/csv`, {
      responseType: 'blob',
    });
    saveBlobAsFile(new Blob([res.data], { type: 'text/csv' }), filename);
  },

  // --- RESULTS VIEW (RECORD-BY-RECORD CRAWLED OUTPUT) ---
  async getResults(params?: {
    batch_id?: string;
    product?: string;
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ResultsListResponse> {
    const queryParams: Record<string, string | number> = {};
    if (params?.batch_id && params.batch_id !== 'all') queryParams.batch_id = params.batch_id;
    if (params?.product) queryParams.product = params.product;
    if (params?.search) queryParams.search = params.search;
    if (params?.status && params.status !== 'all') queryParams.status = params.status;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    const res = await apiClient.get<ResultsListResponse>('/results', { params: queryParams });
    return res.data;
  },

  async promoteSchoolToProduction(stagingId: string): Promise<{ message: string; school_name: string }> {
    const res = await apiClient.post(`/results/${encodeURIComponent(stagingId)}/promote`);
    return res.data;
  },

  async downloadResultsHtml(params?: { batch_id?: string; product?: string; search?: string; status?: string }): Promise<void> {
    const queryParams: Record<string, string> = {};
    if (params?.batch_id && params.batch_id !== 'all') queryParams.batch_id = params.batch_id;
    if (params?.product) queryParams.product = params.product;
    if (params?.search) queryParams.search = params.search;
    if (params?.status && params.status !== 'all') queryParams.status = params.status;

    const res = await apiClient.get('/results/export/html', {
      params: queryParams,
      responseType: 'blob',
    });
    saveBlobAsFile(new Blob([res.data], { type: 'text/html' }), `results-${params?.product || 'report'}.html`);
  },

  async downloadResultsExcel(params?: { batch_id?: string; product?: string; search?: string; status?: string }): Promise<void> {
    const queryParams: Record<string, string> = {};
    if (params?.batch_id && params.batch_id !== 'all') queryParams.batch_id = params.batch_id;
    if (params?.product) queryParams.product = params.product;
    if (params?.search) queryParams.search = params.search;
    if (params?.status && params.status !== 'all') queryParams.status = params.status;

    const res = await apiClient.get('/results/export/excel', {
      params: queryParams,
      responseType: 'blob',
    });
    saveBlobAsFile(
      new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `results-${params?.product || 'report'}.xlsx`
    );
  },

  async downloadResultsCsv(params?: { batch_id?: string; product?: string; search?: string; status?: string }): Promise<void> {
    const queryParams: Record<string, string> = {};
    if (params?.batch_id && params.batch_id !== 'all') queryParams.batch_id = params.batch_id;
    if (params?.product) queryParams.product = params.product;
    if (params?.search) queryParams.search = params.search;
    if (params?.status && params.status !== 'all') queryParams.status = params.status;

    const res = await apiClient.get('/results/export/csv', {
      params: queryParams,
      responseType: 'blob',
    });
    saveBlobAsFile(new Blob([res.data], { type: 'text/csv' }), `results-${params?.product || 'report'}.csv`);
  },
};

