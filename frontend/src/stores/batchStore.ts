import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type {
  BatchSummaryItem,
  BatchDetailResponse,
  BatchUpdateRequest,
  AddBatchSchoolRequest,
} from '../types';

interface BatchState {
  batches: BatchSummaryItem[];
  selectedBatch: BatchDetailResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: string;

  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  fetchBatches: (params?: { status?: string; search?: string }) => Promise<void>;
  fetchBatchDetail: (id: string) => Promise<BatchDetailResponse | null>;
  updateBatch: (id: string, payload: BatchUpdateRequest) => Promise<boolean>;
  softDeleteBatch: (id: string) => Promise<boolean>;
  addSchoolToBatch: (batchId: string, payload: AddBatchSchoolRequest) => Promise<boolean>;
  dropSchoolFromBatch: (batchId: string, schoolId: string) => Promise<boolean>;
  clearSelectedBatch: () => void;
  reset: () => void;
}

const initialBatchState = {
  batches: [] as BatchSummaryItem[],
  selectedBatch: null as BatchDetailResponse | null,
  isLoading: false,
  isSaving: false,
  error: null as string | null,
  searchQuery: '',
  statusFilter: 'All',
};

let batchFetchSeq = 0;

export const useBatchStore = create<BatchState>()((set, get) => ({
  ...initialBatchState,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  fetchBatches: async (params) => {
    const seq = ++batchFetchSeq;
    set({ isLoading: true, error: null });
    try {
      const { statusFilter, searchQuery } = get();
      const status = params?.status !== undefined ? params.status : statusFilter;
      const search = params?.search !== undefined ? params.search : searchQuery;
      const batches = await api.getBatches({ status, search });
      if (seq === batchFetchSeq) {
        set({ batches, isLoading: false });
      }
    } catch (err) {
      if (seq === batchFetchSeq) {
        set({ error: formatApiError(err), isLoading: false });
      }
    }
  },

  fetchBatchDetail: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.getBatchDetail(id);
      set({ selectedBatch: data, isLoading: false });
      return data;
    } catch (err) {
      set({ error: formatApiError(err), isLoading: false });
      return null;
    }
  },

  updateBatch: async (id: string, payload: BatchUpdateRequest) => {
    set({ isSaving: true, error: null });
    try {
      await api.updateBatch(id, payload);
      // Refresh current detail if viewing
      if (get().selectedBatch?.batch.id === id) {
        await get().fetchBatchDetail(id);
      }
      await get().fetchBatches();
      set({ isSaving: false });
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  softDeleteBatch: async (id: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.deleteBatch(id);
      set((state) => ({
        batches: state.batches.filter((b) => b.id !== id),
        selectedBatch: state.selectedBatch?.batch.id === id ? null : state.selectedBatch,
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  addSchoolToBatch: async (batchId: string, payload: AddBatchSchoolRequest) => {
    set({ isSaving: true, error: null });
    try {
      await api.addSchoolToBatch(batchId, payload);
      await get().fetchBatchDetail(batchId);
      await get().fetchBatches();
      set({ isSaving: false });
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  dropSchoolFromBatch: async (batchId: string, schoolId: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.dropSchoolFromBatch(batchId, schoolId);
      await get().fetchBatchDetail(batchId);
      await get().fetchBatches();
      set({ isSaving: false });
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  clearSelectedBatch: () => set({ selectedBatch: null }),

  reset: () => set(initialBatchState),
}));
