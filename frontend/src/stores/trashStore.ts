import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type { BatchSummaryItem, SchoolTrashItem } from '../types';

export type TrashTab = 'batches' | 'schools';

interface TrashState {
  trashBatches: BatchSummaryItem[];
  trashSchools: SchoolTrashItem[];
  activeTab: TrashTab;
  isLoading: boolean;
  isSaving: boolean;
  isPurging: boolean;
  error: string | null;
  searchQuery: string;

  setActiveTab: (tab: TrashTab) => void;
  setSearchQuery: (query: string) => void;
  fetchTrashBatches: (search?: string) => Promise<void>;
  fetchTrashSchools: (search?: string) => Promise<void>;
  restoreBatch: (id: string) => Promise<boolean>;
  permanentDeleteBatch: (id: string) => Promise<boolean>;
  restoreSchool: (id: string) => Promise<boolean>;
  permanentDeleteSchool: (id: string) => Promise<boolean>;
  purgeExpired: (retentionDays?: number) => Promise<{ purged_count?: number; count?: number; message?: string } | null>;
  reset: () => void;
}

const initialTrashState = {
  trashBatches: [] as BatchSummaryItem[],
  trashSchools: [] as SchoolTrashItem[],
  activeTab: 'batches' as TrashTab,
  isLoading: false,
  isSaving: false,
  isPurging: false,
  error: null as string | null,
  searchQuery: '',
};

let trashBatchesFetchSeq = 0;
let trashSchoolsFetchSeq = 0;

export const useTrashStore = create<TrashState>()((set, get) => ({
  ...initialTrashState,

  setActiveTab: (activeTab) => set({ activeTab, searchQuery: '', error: null }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  fetchTrashBatches: async (search) => {
    const seq = ++trashBatchesFetchSeq;
    set({ isLoading: true, error: null });
    try {
      const q = search !== undefined ? search : get().searchQuery;
      const data = await api.getTrashBatches({ search: q });
      if (seq === trashBatchesFetchSeq) {
        set({ trashBatches: Array.isArray(data) ? data : [], isLoading: false });
      }
    } catch (err) {
      if (seq === trashBatchesFetchSeq) {
        set({ error: formatApiError(err), isLoading: false });
      }
    }
  },

  fetchTrashSchools: async (search) => {
    const seq = ++trashSchoolsFetchSeq;
    set({ isLoading: true, error: null });
    try {
      const q = search !== undefined ? search : get().searchQuery;
      const data = await api.getTrashSchools({ search: q });
      if (seq === trashSchoolsFetchSeq) {
        set({ trashSchools: Array.isArray(data) ? data : [], isLoading: false });
      }
    } catch (err) {
      if (seq === trashSchoolsFetchSeq) {
        set({ error: formatApiError(err), isLoading: false });
      }
    }
  },

  restoreBatch: async (id: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.restoreBatch(id);
      set((state) => ({
        trashBatches: state.trashBatches.filter((b) => b.id !== id),
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  permanentDeleteBatch: async (id: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.permanentDeleteBatch(id);
      set((state) => ({
        trashBatches: state.trashBatches.filter((b) => b.id !== id),
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  restoreSchool: async (id: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.restoreSchool(id);
      set((state) => ({
        trashSchools: state.trashSchools.filter((s) => s.id !== id),
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  permanentDeleteSchool: async (id: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.permanentDeleteSchool(id);
      set((state) => ({
        trashSchools: state.trashSchools.filter((s) => s.id !== id),
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  purgeExpired: async (retentionDays = 30) => {
    set({ isPurging: true, error: null });
    try {
      const activeTab = get().activeTab;
      if (activeTab === 'batches') {
        const res = await api.purgeExpiredTrash(retentionDays);
        await get().fetchTrashBatches();
        set({ isPurging: false });
        return res;
      } else {
        const res = await api.purgeExpiredSchools(retentionDays);
        await get().fetchTrashSchools();
        set({ isPurging: false });
        return res;
      }
    } catch (err) {
      set({ error: formatApiError(err), isPurging: false });
      return null;
    }
  },

  reset: () => set(initialTrashState),
}));
