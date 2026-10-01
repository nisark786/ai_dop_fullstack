import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type {
  ResolvedValue,
  VerificationSchoolItem,
  BatchSummaryItem,
} from '../types';

export interface ReviewState {
  // Legacy queue state
  items: ResolvedValue[];
  selectedSchoolId: string;

  // Modern School Queue state
  schools: VerificationSchoolItem[];
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;

  // Filter states
  selectedBatchId: string;
  selectedProductKey: string;
  searchQuery: string;

  // Batches dropdown
  batches: BatchSummaryItem[];
  isLoadingBatches: boolean;

  // Multi-selection checkboxes
  selectedSchoolIds: string[];

  // Side slide drawer
  selectedSchool: VerificationSchoolItem | null;
  isDrawerOpen: boolean;

  // Actions
  fetchBatches: () => Promise<void>;
  fetchReviewSchools: (queueType: 'verification' | 'approved' | 'recrawl') => Promise<void>;
  setSelectedBatchId: (batchId: string, queueType?: 'verification' | 'approved' | 'recrawl') => void;
  setSelectedProductKey: (productKey: string, queueType?: 'verification' | 'approved' | 'recrawl') => void;
  setSearchQuery: (query: string) => void;
  toggleSelectSchool: (id: string) => void;
  selectAllSchools: (ids: string[]) => void;
  clearSelection: () => void;
  openDrawer: (school: VerificationSchoolItem) => void;
  closeDrawer: () => void;

  // Bulk / School Actions
  executeAction: (params: {
    action: 'approve' | 'reject' | 'undo' | 'publish';
    scope: 'single' | 'group' | 'batch';
    schoolIds?: string[];
    batchId?: string;
    queueType: 'verification' | 'approved' | 'recrawl';
  }) => Promise<string>;

  // Re-crawl agent execution
  recrawlSchool: (
    schoolId: string,
    batchId: string,
    queueType: 'verification' | 'approved' | 'recrawl'
  ) => Promise<string>;
  recrawlBatch: (
    batchId: string,
    schoolIds: string[],
    queueType: 'verification' | 'approved' | 'recrawl'
  ) => Promise<string>;

  // Legacy compatibility actions
  fetchQueue: () => Promise<void>;
  approveItem: (id: string) => Promise<boolean>;
  correctItem: (id: string, correctedValue: string) => Promise<boolean>;
  rejectItem: (id: string) => Promise<boolean>;
  approveAllForSchool: (itemIds: string[]) => Promise<{ success: number; failed: number }>;
  setSelectedSchoolId: (id: string) => void;
  reset: () => void;
}

const initialReviewState = {
  items: [] as ResolvedValue[],
  selectedSchoolId: '',
  schools: [] as VerificationSchoolItem[],
  isLoading: false,
  isProcessing: false,
  error: null as string | null,

  selectedBatchId: 'all',
  selectedProductKey: 'info',
  searchQuery: '',

  batches: [] as BatchSummaryItem[],
  isLoadingBatches: false,

  selectedSchoolIds: [] as string[],

  selectedSchool: null as VerificationSchoolItem | null,
  isDrawerOpen: false,
};

export const useReviewStore = create<ReviewState>()((set, get) => ({
  ...initialReviewState,

  fetchBatches: async () => {
    set({ isLoadingBatches: true });
    try {
      const batches = await api.getBatches({ limit: 100 });
      set({ batches, isLoadingBatches: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingBatches: false });
    }
  },

  fetchReviewSchools: async (queueType: 'verification' | 'approved' | 'recrawl') => {
    set({ isLoading: true, error: null });
    const { selectedBatchId, selectedProductKey, searchQuery } = get();
    try {
      const schools = await api.getReviewSchools({
        batch_id: selectedBatchId,
        product: selectedProductKey,
        queue_type: queueType,
        search: searchQuery,
      });
      set({
        schools,
        isLoading: false,
        selectedSchoolIds: [], // reset selection on re-fetch
      });
    } catch (err) {
      set({ error: formatApiError(err), isLoading: false });
    }
  },

  setSelectedBatchId: (batchId: string, queueType?: 'verification' | 'approved' | 'recrawl') => {
    set({ selectedBatchId: batchId });
    if (queueType) {
      get().fetchReviewSchools(queueType);
    }
  },

  setSelectedProductKey: (productKey: string, queueType?: 'verification' | 'approved' | 'recrawl') => {
    set({ selectedProductKey: productKey });
    if (queueType) {
      get().fetchReviewSchools(queueType);
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  toggleSelectSchool: (id: string) => {
    const current = get().selectedSchoolIds;
    if (current.includes(id)) {
      set({ selectedSchoolIds: current.filter((sId) => sId !== id) });
    } else {
      set({ selectedSchoolIds: [...current, id] });
    }
  },

  selectAllSchools: (ids: string[]) => set({ selectedSchoolIds: ids }),

  clearSelection: () => set({ selectedSchoolIds: [] }),

  openDrawer: (school: VerificationSchoolItem) => {
    set({ selectedSchool: school, isDrawerOpen: true });
  },

  closeDrawer: () => {
    set({ selectedSchool: null, isDrawerOpen: false });
  },

  executeAction: async ({
    action,
    scope,
    schoolIds,
    batchId,
    queueType,
  }) => {
    set({ isProcessing: true, error: null });
    try {
      const targetBatchId =
        batchId || (get().selectedBatchId !== 'all' ? get().selectedBatchId : null);
      const res = await api.executeReviewAction({
        action,
        scope,
        school_ids: schoolIds || get().selectedSchoolIds,
        batch_id: targetBatchId,
        product: get().selectedProductKey,
      });

      // Close drawer if active school was affected
      const currentSelected = get().selectedSchool;
      if (
        currentSelected &&
        (scope === 'batch' || res.updated_school_ids.includes(currentSelected.id))
      ) {
        set({ isDrawerOpen: false, selectedSchool: null });
      }

      await get().fetchReviewSchools(queueType);
      set({ isProcessing: false });
      return res.message;
    } catch (err) {
      const msg = formatApiError(err);
      set({ error: msg, isProcessing: false });
      throw new Error(msg);
    }
  },

  recrawlSchool: async (schoolId, batchId, queueType) => {
    set({ isProcessing: true, error: null });
    try {
      await api.runAgentsForBatch({
        batch_ids: [batchId],
        agent_keys: [get().selectedProductKey],
        scope: 'single',
        school_ids: [schoolId],
        force_refresh: true,
      });
      await get().fetchReviewSchools(queueType);
      set({ isProcessing: false });
      return 'Dispatched re-crawl agent for school. It will return to Verification Queue upon completion.';
    } catch (err) {
      const msg = formatApiError(err);
      set({ error: msg, isProcessing: false });
      throw new Error(msg);
    }
  },

  recrawlBatch: async (batchId, schoolIds, queueType) => {
    set({ isProcessing: true, error: null });
    try {
      await api.runAgentsForBatch({
        batch_ids: [batchId],
        agent_keys: [get().selectedProductKey],
        scope: schoolIds.length > 0 ? 'group' : 'batch',
        school_ids: schoolIds,
        force_refresh: true,
      });
      await get().fetchReviewSchools(queueType);
      set({ isProcessing: false });
      return `Dispatched re-crawl agent across ${schoolIds.length > 0 ? schoolIds.length : 'all'} schools in batch.`;
    } catch (err) {
      const msg = formatApiError(err);
      set({ error: msg, isProcessing: false });
      throw new Error(msg);
    }
  },

  // Legacy methods
  setSelectedSchoolId: (selectedSchoolId) => set({ selectedSchoolId }),

  fetchQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await api.getReviewQueue();
      set({ items, isLoading: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoading: false });
    }
  },

  approveItem: async (id: string) => {
    set({ isProcessing: true, error: null });
    try {
      await api.approveReview(id);
      set((state) => ({
        items: state.items.map((it) => (it.id === id ? { ...it, review_status: 'approved' } : it)),
        isProcessing: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isProcessing: false });
      return false;
    }
  },

  correctItem: async (id: string, correctedValue: string) => {
    set({ isProcessing: true, error: null });
    try {
      await api.correctReview(id, correctedValue);
      set((state) => ({
        items: state.items.map((it) =>
          it.id === id ? { ...it, value: correctedValue, review_status: 'approved' } : it
        ),
        isProcessing: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isProcessing: false });
      return false;
    }
  },

  rejectItem: async (id: string) => {
    set({ isProcessing: true, error: null });
    try {
      await api.rejectReview(id);
      set((state) => ({
        items: state.items.map((it) => (it.id === id ? { ...it, review_status: 'rejected' } : it)),
        isProcessing: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isProcessing: false });
      return false;
    }
  },

  approveAllForSchool: async (itemIds: string[]) => {
    if (itemIds.length === 0) return { success: 0, failed: 0 };
    set({ isProcessing: true, error: null });

    const results = await Promise.allSettled(
      itemIds.map((id) => api.approveReview(id))
    );

    let success = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        success++;
      } else {
        failed++;
      }
    }

    if (failed > 0) {
      set({ error: `Failed to approve ${failed} field(s).` });
    }

    await get().fetchQueue();
    set({ isProcessing: false });
    return { success, failed };
  },

  reset: () => set(initialReviewState),
}));
