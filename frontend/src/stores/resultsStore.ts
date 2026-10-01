import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type { ResultSchoolItem, ResultsSummary, BatchSummaryItem } from '../types';

interface ResultsState {
  records: ResultSchoolItem[];
  summary: ResultsSummary | null;
  isLoading: boolean;
  isExporting: boolean;
  isPromoting: boolean;
  error: string | null;

  // Filter states
  selectedBatchId: string;
  selectedProductKey: string;
  searchQuery: string;
  statusFilter: string;

  // Dropdown data
  batches: BatchSummaryItem[];
  isLoadingBatches: boolean;

  // Record Detail Drawer
  selectedRecord: ResultSchoolItem | null;
  isDrawerOpen: boolean;

  // Actions
  fetchResults: () => Promise<void>;
  fetchBatches: () => Promise<void>;
  setSelectedBatchId: (batchId: string) => void;
  setSelectedProductKey: (productKey: string) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  openDrawer: (record: ResultSchoolItem) => void;
  closeDrawer: () => void;
  exportResults: (format: 'excel' | 'csv' | 'html') => Promise<void>;
  promoteSchool: (stagingId: string) => Promise<string>;
  reset: () => void;
}

const initialResultsState = {
  records: [] as ResultSchoolItem[],
  summary: null as ResultsSummary | null,
  isLoading: false,
  isExporting: false,
  isPromoting: false,
  error: null as string | null,

  selectedBatchId: 'all',
  selectedProductKey: 'info',
  searchQuery: '',
  statusFilter: 'all',

  batches: [] as BatchSummaryItem[],
  isLoadingBatches: false,

  selectedRecord: null as ResultSchoolItem | null,
  isDrawerOpen: false,
};

export const useResultsStore = create<ResultsState>()((set, get) => ({
  ...initialResultsState,

  fetchResults: async () => {
    set({ isLoading: true, error: null });
    const { selectedBatchId, selectedProductKey, searchQuery, statusFilter } = get();
    try {
      const res = await api.getResults({
        batch_id: selectedBatchId,
        product: selectedProductKey,
        search: searchQuery,
        status: statusFilter,
      });
      set({
        records: res.records,
        summary: res.summary,
        isLoading: false,
      });
    } catch (err) {
      set({ error: formatApiError(err), isLoading: false });
    }
  },

  fetchBatches: async () => {
    set({ isLoadingBatches: true });
    try {
      const batches = await api.getBatches({ limit: 100 });
      set({ batches, isLoadingBatches: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingBatches: false });
    }
  },

  setSelectedBatchId: (batchId: string) => {
    set({ selectedBatchId: batchId });
    get().fetchResults();
  },

  setSelectedProductKey: (productKey: string) => {
    set({ selectedProductKey: productKey });
    get().fetchResults();
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setStatusFilter: (status: string) => {
    set({ statusFilter: status });
    get().fetchResults();
  },

  openDrawer: (record: ResultSchoolItem) => {
    set({ selectedRecord: record, isDrawerOpen: true });
  },

  closeDrawer: () => {
    set({ isDrawerOpen: false });
  },

  exportResults: async (format: 'excel' | 'csv' | 'html') => {
    set({ isExporting: true, error: null });
    const { selectedBatchId, selectedProductKey, searchQuery, statusFilter } = get();
    const params = {
      batch_id: selectedBatchId,
      product: selectedProductKey,
      search: searchQuery,
      status: statusFilter,
    };
    try {
      if (format === 'html') {
        await api.downloadResultsHtml(params);
      } else if (format === 'excel') {
        await api.downloadResultsExcel(params);
      } else if (format === 'csv') {
        await api.downloadResultsCsv(params);
      }
    } catch (err) {
      set({ error: formatApiError(err) });
      throw err;
    } finally {
      set({ isExporting: false });
    }
  },

  promoteSchool: async (stagingId: string) => {
    set({ isPromoting: true, error: null });
    try {
      const res = await api.promoteSchoolToProduction(stagingId);
      // Refresh current results so row status reflects "Published"
      await get().fetchResults();
      return res.message;
    } catch (err) {
      const msg = formatApiError(err);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isPromoting: false });
    }
  },

  reset: () => set(initialResultsState),
}));
