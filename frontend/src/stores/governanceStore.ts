import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type {
  SourceRegistryItem,
  PublishedRecord,
  PromptTemplate,
  CostSummary,
  CostInvocationsResponse,
} from '../types';

interface GovernanceState {
  sources: SourceRegistryItem[];
  publishedRecords: PublishedRecord[];
  prompts: PromptTemplate[];
  costSummary: CostSummary | null;
  costInvocations: CostInvocationsResponse | null;

  isLoadingSources: boolean;
  isLoadingPublished: boolean;
  isLoadingPrompts: boolean;
  isLoadingCosts: boolean;
  error: string | null;

  fetchSources: () => Promise<void>;
  updateSourceWeight: (id: string, newWeight: number) => Promise<boolean>;
  fetchPublishedData: () => Promise<void>;
  fetchPrompts: () => Promise<void>;
  fetchCostSummary: (days?: number) => Promise<void>;
  fetchCostInvocations: (params?: {
    page?: number;
    page_size?: number;
    agent_name?: string;
    batch_id?: string;
  }) => Promise<void>;
  reset: () => void;
}

const initialGovernanceState = {
  sources: [] as SourceRegistryItem[],
  publishedRecords: [] as PublishedRecord[],
  prompts: [] as PromptTemplate[],
  costSummary: null as CostSummary | null,
  costInvocations: null as CostInvocationsResponse | null,
  isLoadingSources: false,
  isLoadingPublished: false,
  isLoadingPrompts: false,
  isLoadingCosts: false,
  error: null as string | null,
};

export const useGovernanceStore = create<GovernanceState>()((set) => ({
  ...initialGovernanceState,

  fetchSources: async () => {
    set({ isLoadingSources: true, error: null });
    try {
      const sources = await api.getSources();
      set({ sources, isLoadingSources: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingSources: false });
    }
  },

  updateSourceWeight: async (id, newWeight) => {
    try {
      await api.updateSourceWeight(id, newWeight);
      set((state) => ({
        sources: state.sources.map((s) => (s.id === id ? { ...s, default_weight: newWeight } : s)),
      }));
      return true;
    } catch (err) {
      set({ error: formatApiError(err) });
      return false;
    }
  },

  fetchPublishedData: async () => {
    set({ isLoadingPublished: true, error: null });
    try {
      const records = await api.getPublishedData();
      set({ publishedRecords: records, isLoadingPublished: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingPublished: false });
    }
  },

  fetchPrompts: async () => {
    set({ isLoadingPrompts: true, error: null });
    try {
      const prompts = await api.getPrompts();
      set({ prompts, isLoadingPrompts: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingPrompts: false });
    }
  },

  fetchCostSummary: async (days = 7) => {
    set({ isLoadingCosts: true, error: null });
    try {
      const costSummary = await api.getCostSummary(days);
      set({ costSummary, isLoadingCosts: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingCosts: false });
    }
  },

  fetchCostInvocations: async (params) => {
    set({ isLoadingCosts: true, error: null });
    try {
      const costInvocations = await api.getCostInvocations(params);
      set({ costInvocations, isLoadingCosts: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingCosts: false });
    }
  },

  reset: () => set(initialGovernanceState),
}));
