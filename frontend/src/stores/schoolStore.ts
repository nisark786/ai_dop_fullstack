import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type { School, SchoolStats, SchoolCreateInput } from '../types';

export interface SchoolFilters {
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  verificationFilter: string;
  schoolTypeFilter: string;
  missingWebsiteOnly: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface SchoolState {
  schools: School[];
  stats: SchoolStats | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Pagination
  page: number;
  pageSize: number;
  totalSchools: number;
  totalPages: number;

  // Filters
  filters: SchoolFilters;

  // Selection
  selectedSchoolIds: Set<string>;

  // Actions
  fetchSchools: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (newFilters: Partial<SchoolFilters>) => void;
  resetFilters: () => void;
  toggleSchoolSelection: (schoolId: string) => void;
  selectAllSchools: (schoolIds: string[]) => void;
  clearSelection: () => void;
  updateSchool: (schoolId: string, updates: Partial<School>) => Promise<boolean>;
  createSchool: (data: SchoolCreateInput) => Promise<School | null>;
  deleteSchool: (schoolId: string) => Promise<boolean>;
  bulkToggleActive: (active: boolean) => Promise<{ successCount: number; failCount: number }>;
  reset: () => void;
}

const DEFAULT_FILTERS: SchoolFilters = {
  searchQuery: '',
  statusFilter: 'all',
  verificationFilter: 'all',
  schoolTypeFilter: 'all',
  missingWebsiteOnly: false,
  sortBy: 'name',
  sortOrder: 'asc',
};

const initialSchoolState = {
  schools: [] as School[],
  stats: null as SchoolStats | null,
  isLoading: false,
  isSaving: false,
  error: null as string | null,
  page: 1,
  pageSize: 25,
  totalSchools: 0,
  totalPages: 1,
};

let schoolFetchSeq = 0;

export const useSchoolStore = create<SchoolState>()((set, get) => ({
  ...initialSchoolState,
  filters: { ...DEFAULT_FILTERS },
  selectedSchoolIds: new Set<string>(),

  fetchSchools: async () => {
    const seq = ++schoolFetchSeq;
    set({ isLoading: true, error: null });
    try {
      const { page, pageSize, filters } = get();
      const [paginatedResp, schoolStats] = await Promise.all([
        api.getPaginatedSchools({
          page,
          page_size: pageSize,
          status: filters.statusFilter !== 'all' ? filters.statusFilter : undefined,
          verification_status: filters.verificationFilter !== 'all' ? filters.verificationFilter : undefined,
          school_type: filters.schoolTypeFilter !== 'all' ? filters.schoolTypeFilter : undefined,
          missing_website: filters.missingWebsiteOnly ? true : undefined,
          search: filters.searchQuery.trim() || undefined,
          sort_by: filters.sortBy,
          sort_order: filters.sortOrder,
        }),
        get().stats ? Promise.resolve(null) : api.getSchoolStats().catch(() => null),
      ]);

      // Guard against race conditions from previous search keystrokes
      if (seq !== schoolFetchSeq) return;

      set({
        schools: paginatedResp.items || [],
        totalSchools: paginatedResp.total || 0,
        totalPages: paginatedResp.total_pages || 1,
        stats: schoolStats || get().stats,
        isLoading: false,
      });
    } catch (err) {
      if (seq === schoolFetchSeq) {
        set({ error: formatApiError(err), isLoading: false });
      }
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.getSchoolStats();
      set({ stats });
    } catch (err) {
      set({ error: formatApiError(err) });
    }
  },

  setPage: (page: number) => {
    set({ page });
    get().fetchSchools();
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 });
    get().fetchSchools();
  },

  setFilters: (newFilters: Partial<SchoolFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1, // Reset to page 1 on filter changes
    }));
    get().fetchSchools();
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS }, page: 1 });
    get().fetchSchools();
  },

  toggleSchoolSelection: (schoolId: string) => {
    set((state) => {
      const next = new Set(state.selectedSchoolIds);
      if (next.has(schoolId)) {
        next.delete(schoolId);
      } else {
        next.add(schoolId);
      }
      return { selectedSchoolIds: next };
    });
  },

  selectAllSchools: (schoolIds: string[]) => {
    set((state) => {
      const allSelected = schoolIds.every((id) => state.selectedSchoolIds.has(id));
      const next = new Set(state.selectedSchoolIds);
      if (allSelected) {
        schoolIds.forEach((id) => next.delete(id));
      } else {
        schoolIds.forEach((id) => next.add(id));
      }
      return { selectedSchoolIds: next };
    });
  },

  clearSelection: () => set({ selectedSchoolIds: new Set() }),

  updateSchool: async (schoolId: string, updates: Partial<School>) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await api.updateSchool(schoolId, updates);
      set((state) => ({
        schools: state.schools.map((s) => (s.id === schoolId ? { ...s, ...updated } : s)),
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  createSchool: async (data: SchoolCreateInput) => {
    set({ isSaving: true, error: null });
    try {
      const created = await api.createSchool(data);
      await get().fetchSchools();
      get().fetchStats();
      set({ isSaving: false });
      return created;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return null;
    }
  },

  deleteSchool: async (schoolId: string) => {
    set({ isSaving: true, error: null });
    try {
      await api.deleteSchool(schoolId);
      set((state) => ({
        schools: state.schools.filter((s) => s.id !== schoolId),
        totalSchools: Math.max(0, state.totalSchools - 1),
        isSaving: false,
      }));
      get().fetchStats();
      return true;
    } catch (err) {
      set({ error: formatApiError(err), isSaving: false });
      return false;
    }
  },

  bulkToggleActive: async (active: boolean) => {
    const { selectedSchoolIds, schools } = get();
    const targets = schools.filter(
      (s) => selectedSchoolIds.has(s.id) && s.is_active !== active
    );

    if (targets.length === 0) {
      return { successCount: 0, failCount: 0 };
    }

    set({ isSaving: true, error: null });

    const results = await Promise.allSettled(
      targets.map((s) => api.updateSchool(s.id, { is_active: active }))
    );

    let successCount = 0;
    let failCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
      }
    }

    if (failCount > 0) {
      set({ error: `Failed to update status for ${failCount} school(s).` });
    }

    await get().fetchSchools();
    get().fetchStats();
    get().clearSelection();
    set({ isSaving: false });

    return { successCount, failCount };
  },

  reset: () =>
    set({
      ...initialSchoolState,
      filters: { ...DEFAULT_FILTERS },
      selectedSchoolIds: new Set<string>(),
    }),
}));
