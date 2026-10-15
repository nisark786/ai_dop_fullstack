import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type { CostSummary, CostInvocationsResponse } from '../types';

interface CostState {
  // Filters & Pagination
  daysPeriod: number;
  agentFilter: string;
  batchFilter: string;
  currentPage: number;
  pageSize: number;

  // Data & Status
  summary: CostSummary | null;
  invocationsData: CostInvocationsResponse | null;
  isLoadingSummary: boolean;
  isLoadingInvocations: boolean;
  isRefreshing: boolean;
  isExporting: boolean;
  lastUpdated: Date;
  error: string | null;

  // Actions
  setDaysPeriod: (days: number) => void;
  setAgentFilter: (agent: string) => void;
  setBatchFilter: (batch: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetFilters: () => void;

  fetchSummary: () => Promise<void>;
  fetchInvocations: () => Promise<void>;
  refreshAll: () => Promise<void>;
  exportAuditCsv: () => Promise<void>;
}

export const useCostStore = create<CostState>()((set, get) => ({
  daysPeriod: 7,
  agentFilter: '',
  batchFilter: '',
  currentPage: 1,
  pageSize: 15,

  summary: null,
  invocationsData: null,
  isLoadingSummary: false,
  isLoadingInvocations: false,
  isRefreshing: false,
  isExporting: false,
  lastUpdated: new Date(),
  error: null,

  setDaysPeriod: (days: number) => {
    set({ daysPeriod: days, currentPage: 1 });
    void get().fetchSummary();
    void get().fetchInvocations();
  },

  setAgentFilter: (agent: string) => {
    set({ agentFilter: agent, currentPage: 1 });
    void get().fetchInvocations();
  },

  setBatchFilter: (batch: string) => {
    set({ batchFilter: batch, currentPage: 1 });
    void get().fetchInvocations();
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
    void get().fetchInvocations();
  },

  setPageSize: (size: number) => {
    set({ pageSize: size, currentPage: 1 });
    void get().fetchInvocations();
  },

  resetFilters: () => {
    set({ agentFilter: '', batchFilter: '', currentPage: 1 });
    void get().fetchInvocations();
  },

  fetchSummary: async () => {
    set({ isLoadingSummary: true, error: null });
    try {
      const summary = await api.getCostSummary(get().daysPeriod);
      set({ summary, isLoadingSummary: false, lastUpdated: new Date() });
    } catch (err) {
      set({
        isLoadingSummary: false,
        error: formatApiError(err),
      });
    }
  },

  fetchInvocations: async () => {
    set({ isLoadingInvocations: true, error: null });
    try {
      const { currentPage, pageSize, agentFilter, batchFilter } = get();
      const invocationsData = await api.getCostInvocations({
        page: currentPage,
        page_size: pageSize,
        agent_name: agentFilter.trim() || undefined,
        batch_id: batchFilter.trim() || undefined,
      });
      set({ invocationsData, isLoadingInvocations: false, lastUpdated: new Date() });
    } catch (err) {
      set({
        isLoadingInvocations: false,
        error: formatApiError(err),
      });
    }
  },

  refreshAll: async () => {
    set({ isRefreshing: true, error: null });
    try {
      await Promise.all([get().fetchSummary(), get().fetchInvocations()]);
      set({ isRefreshing: false, lastUpdated: new Date() });
    } catch (err) {
      set({
        isRefreshing: false,
        error: formatApiError(err),
      });
    }
  },

  exportAuditCsv: async () => {
    set({ isExporting: true, error: null });
    try {
      const { daysPeriod, agentFilter, batchFilter } = get();
      await api.downloadCostLogsCsv({
        days: daysPeriod,
        agent_name: agentFilter.trim() || undefined,
        batch_id: batchFilter.trim() || undefined,
      });
      set({ isExporting: false });
    } catch (err) {
      set({
        isExporting: false,
        error: formatApiError(err),
      });
    }
  },
}));
