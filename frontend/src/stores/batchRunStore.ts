import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type { BatchRunSummary, BatchRunDetailResponse } from '../types';

interface BatchRunState {
  runs: BatchRunSummary[];
  selectedRun: BatchRunDetailResponse | null;
  isLoadingRuns: boolean;
  isLoadingDetail: boolean;
  isExporting: boolean;
  error: string | null;

  fetchRuns: () => Promise<void>;
  fetchRunDetail: (jobId: string) => Promise<void>;
  downloadExport: (jobId: string, format: 'html' | 'excel' | 'csv') => Promise<void>;
  reset: () => void;
}

const initialBatchRunState = {
  runs: [] as BatchRunSummary[],
  selectedRun: null as BatchRunDetailResponse | null,
  isLoadingRuns: false,
  isLoadingDetail: false,
  isExporting: false,
  error: null as string | null,
};

export const useBatchRunStore = create<BatchRunState>()((set) => ({
  ...initialBatchRunState,

  fetchRuns: async () => {
    set({ isLoadingRuns: true, error: null });
    try {
      const runs = await api.getBatchRuns();
      set({ runs, isLoadingRuns: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingRuns: false });
    }
  },

  fetchRunDetail: async (jobId: string) => {
    set({ isLoadingDetail: true, error: null });
    try {
      const selectedRun = await api.getBatchRunDetail(jobId);
      set({ selectedRun, isLoadingDetail: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingDetail: false });
    }
  },

  downloadExport: async (jobId: string, format: 'html' | 'excel' | 'csv') => {
    set({ isExporting: true, error: null });
    try {
      if (format === 'html') {
        await api.downloadRunHtml(jobId);
      } else if (format === 'excel') {
        await api.downloadRunExcel(jobId);
      } else if (format === 'csv') {
        await api.downloadRunCsv(jobId);
      }
    } catch (err) {
      set({ error: formatApiError(err) });
    } finally {
      set({ isExporting: false });
    }
  },

  reset: () => set(initialBatchRunState),
}));
