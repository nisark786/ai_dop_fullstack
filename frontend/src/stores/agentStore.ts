import { create } from 'zustand';
import { api } from '../services/api';
import { formatApiError } from '../services/client';
import type { AgentRegistryItem, AgentJobSummary, RunAgentsForBatchResponse } from '../types';

interface AgentState {
  registry: AgentRegistryItem[];
  selectedBatchIds: string[];
  selectedAgentKeys: string[];
  forceRefresh: boolean;
  jobs: AgentJobSummary[];
  isLoadingRegistry: boolean;
  isLoadingJobs: boolean;
  isDispatching: boolean;
  error: string | null;

  fetchRegistry: () => Promise<void>;
  fetchJobs: (batchIds?: string[]) => Promise<void>;
  setSelectedBatchIds: (batchIds: string[]) => void;
  toggleBatchSelection: (batchId: string) => void;
  setSelectedAgentKeys: (keys: string[]) => void;
  toggleAgentSelection: (key: string) => void;
  setForceRefresh: (val: boolean) => void;
  runAgentsForBatch: (batchId: string, agentKeys: string[], force: boolean) => Promise<RunAgentsForBatchResponse | null>;
  runAgentsForMultipleBatches: (batchIds: string[], agentKeys: string[], force: boolean) => Promise<RunAgentsForBatchResponse[]>;
  reset: () => void;
}

const initialAgentState = {
  registry: [] as AgentRegistryItem[],
  selectedBatchIds: [] as string[],
  selectedAgentKeys: ['info'] as string[],
  forceRefresh: false,
  jobs: [] as AgentJobSummary[],
  isLoadingRegistry: false,
  isLoadingJobs: false,
  isDispatching: false,
  error: null as string | null,
};

export const useAgentStore = create<AgentState>()((set, get) => ({
  ...initialAgentState,

  fetchRegistry: async () => {
    set({ isLoadingRegistry: true, error: null });
    try {
      const registry = await api.fetchAgentRegistry();
      set({ registry, isLoadingRegistry: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingRegistry: false });
    }
  },

  fetchJobs: async (batchIds) => {
    const ids = batchIds || get().selectedBatchIds;
    if (!ids || ids.length === 0) {
      set({ jobs: [] });
      return;
    }
    set({ isLoadingJobs: true });
    try {
      const jobs = await api.fetchAgentJobs(ids);
      set({ jobs, isLoadingJobs: false });
    } catch (err) {
      set({ error: formatApiError(err), isLoadingJobs: false });
    }
  },

  setSelectedBatchIds: (selectedBatchIds) => set({ selectedBatchIds }),

  toggleBatchSelection: (batchId) => {
    set((state) => {
      const exists = state.selectedBatchIds.includes(batchId);
      const next = exists
        ? state.selectedBatchIds.filter((id) => id !== batchId)
        : [...state.selectedBatchIds, batchId];
      return { selectedBatchIds: next };
    });
  },

  setSelectedAgentKeys: (selectedAgentKeys) => set({ selectedAgentKeys }),

  toggleAgentSelection: (key) => {
    set((state) => {
      const exists = state.selectedAgentKeys.includes(key);
      const next = exists
        ? state.selectedAgentKeys.filter((k) => k !== key)
        : [...state.selectedAgentKeys, key];
      return { selectedAgentKeys: next };
    });
  },

  setForceRefresh: (forceRefresh) => set({ forceRefresh }),

  runAgentsForBatch: async (batchId, agentKeys, force) => {
    set({ isDispatching: true, error: null });
    try {
      const res = await api.runAgentsForBatch({
        batch_ids: [batchId],
        agent_keys: agentKeys,
        force_refresh: force,
      });
      await get().fetchJobs([batchId]);
      set({ isDispatching: false });
      return res;
    } catch (err) {
      set({ error: formatApiError(err), isDispatching: false });
      return null;
    }
  },

  runAgentsForMultipleBatches: async (batchIds, agentKeys, force) => {
    set({ isDispatching: true, error: null });
    const results: RunAgentsForBatchResponse[] = [];
    try {
      for (const bId of batchIds) {
        const res = await api.runAgentsForBatch({
          batch_ids: [bId],
          agent_keys: agentKeys,
          force_refresh: force,
        });
        results.push(res);
      }
      await get().fetchJobs(batchIds);
      set({ isDispatching: false });
      return results;
    } catch (err) {
      set({ error: formatApiError(err), isDispatching: false });
      return results;
    }
  },

  reset: () => set(initialAgentState),
}));
