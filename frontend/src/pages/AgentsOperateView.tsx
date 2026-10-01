import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Cpu,
  Lock,
  Check,
  ExternalLink,
  Loader2,
  Search,
  X,
  Pause,
  Square,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../services/api';
import { useAgentStore } from '../stores/agentStore';
import { useBatchStore } from '../stores/batchStore';
import { useAppStore } from '../stores/appStore';

export const AgentsOperateView: React.FC = () => {
  const { batches, isLoadingBatches } = useBatchStore(
    useShallow((s) => ({
      batches: s.batches,
      isLoadingBatches: s.isLoading,
    }))
  );
  const fetchBatches = useBatchStore((s) => s.fetchBatches);
  const showToast = useAppStore((s) => s.showToast);

  const {
    registry,
    selectedBatchIds,
    selectedAgentKeys,
    forceRefresh,
    jobs,
    isLoadingRegistry,
  } = useAgentStore(
    useShallow((s) => ({
      registry: s.registry,
      selectedBatchIds: s.selectedBatchIds,
      selectedAgentKeys: s.selectedAgentKeys,
      forceRefresh: s.forceRefresh,
      jobs: s.jobs,
      isLoadingRegistry: s.isLoadingRegistry,
    }))
  );

  const fetchRegistry = useAgentStore((s) => s.fetchRegistry);
  const fetchJobs = useAgentStore((s) => s.fetchJobs);
  const setSelectedBatchIds = useAgentStore((s) => s.setSelectedBatchIds);
  const toggleBatchSelection = useAgentStore((s) => s.toggleBatchSelection);
  const setSelectedAgentKeys = useAgentStore((s) => s.setSelectedAgentKeys);
  const toggleAgentSelection = useAgentStore((s) => s.toggleAgentSelection);
  const setForceRefresh = useAgentStore((s) => s.setForceRefresh);

  // --- Local UI State ---
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [workers, setWorkers] = useState<number>(2);
  const [actionLoadingJobId, setActionLoadingJobId] = useState<string | null>(null);

  // --- Search Filters ---
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [agentSearch, setAgentSearch] = useState<string>('');
  const [dispatchFeedback, setDispatchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Initial Data Load ---
  useEffect(() => {
    fetchBatches();
    fetchRegistry();
  }, [fetchBatches, fetchRegistry]);

  useEffect(() => {
    const activeBatches = batches.filter((b) => b.status !== 'trashed');
    if (activeBatches.length > 0 && selectedBatchIds.length === 0) {
      setSelectedBatchIds([activeBatches[0].id]);
    }
  }, [batches, selectedBatchIds.length, setSelectedBatchIds]);

  // --- Fetch Jobs for Selected Batches ---
  useEffect(() => {
    if (selectedBatchIds.length > 0) {
      fetchJobs(selectedBatchIds);
    }
  }, [selectedBatchIds, fetchJobs]);

  // --- Auto-Polling for Active Jobs ---
  const hasActiveJob = useMemo(() => {
    return jobs.some((j) => j.status === 'running' || j.status === 'pending');
  }, [jobs]);

  const prevHasActiveJobRef = React.useRef(hasActiveJob);
  useEffect(() => {
    if (prevHasActiveJobRef.current && !hasActiveJob) {
      fetchBatches();
    }
    prevHasActiveJobRef.current = hasActiveJob;
  }, [hasActiveJob, fetchBatches]);

  useEffect(() => {
    if (selectedBatchIds.length === 0 || !hasActiveJob) return;
    const interval = setInterval(() => {
      fetchJobs(selectedBatchIds);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedBatchIds, hasActiveJob, fetchJobs]);

  // --- Filtering ---
  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return batches;
    const q = batchSearch.toLowerCase();
    return batches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q))
    );
  }, [batches, batchSearch]);

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return registry;
    const q = agentSearch.toLowerCase();
    return registry.filter(
      (a) =>
        a.product_name.toLowerCase().includes(q) ||
        a.agent_name.toLowerCase().includes(q) ||
        a.product_key.toLowerCase().includes(q) ||
        a.target_fields.some((f) => f.toLowerCase().includes(q))
    );
  }, [registry, agentSearch]);

  // --- Batch Selection Handlers ---
  const selectAllBatches = () => {
    setSelectedBatchIds(filteredBatches.map((b) => b.id));
  };

  const clearBatchesSelection = () => {
    setSelectedBatchIds([]);
  };

  // --- Agent Selection Handlers ---
  const selectAllActiveAgents = () => {
    const activeKeys = registry.filter((a) => a.is_implemented).map((a) => a.product_key);
    setSelectedAgentKeys(activeKeys);
  };

  const clearAgentsSelection = () => {
    setSelectedAgentKeys([]);
  };

  // --- Run Selected Batches and Agents ---
  const handleStartRunning = async () => {
    if (selectedBatchIds.length === 0) {
      setDispatchFeedback({ type: 'error', message: 'Please select at least one batch to execute.' });
      return;
    }
    if (selectedAgentKeys.length === 0) {
      setDispatchFeedback({ type: 'error', message: 'Please select at least one active agent to execute.' });
      return;
    }

    setIsDispatching(true);
    setDispatchFeedback(null);
    try {
      const res = await api.runAgentsForBatch({
        batch_ids: selectedBatchIds,
        agent_keys: selectedAgentKeys,
        scope: 'batch',
        force_refresh: forceRefresh,
        workers: workers,
      });

      setDispatchFeedback({
        type: 'success',
        message: res.message,
      });
      showToast(res.message || 'Agents dispatched successfully!', 'success');

      // Immediately refresh jobs and batches
      await fetchJobs(selectedBatchIds);
      await fetchBatches();
    } catch (err: any) {
      const msg = err.message || 'Failed to dispatch agents.';
      setDispatchFeedback({
        type: 'error',
        message: msg,
      });
      showToast(msg, 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  // --- Job Control Handlers ---
  const handlePauseJob = async (jobId: string) => {
    setActionLoadingJobId(jobId);
    try {
      const res = await api.pauseJob(jobId);
      showToast(res.message || 'Job paused.', 'success');
      await fetchJobs(selectedBatchIds);
      await fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to pause job.', 'error');
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    setActionLoadingJobId(jobId);
    try {
      const res = await api.resumeJob(jobId, workers);
      showToast(res.message || 'Job resumed.', 'success');
      await fetchJobs(selectedBatchIds);
      await fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to resume job.', 'error');
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to cancel this job? Remaining unverified schools will be reset to pending.')) {
      return;
    }
    setActionLoadingJobId(jobId);
    try {
      const res = await api.cancelJob(jobId);
      showToast(res.message || 'Job cancelled.', 'success');
      await fetchJobs(selectedBatchIds);
      await fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel job.', 'error');
    } finally {
      setActionLoadingJobId(null);
    }
  };

  // --- Total Computation for Selected Batches ---
  const totalSchoolsSelected = useMemo(() => {
    return batches
      .filter((b) => selectedBatchIds.includes(b.id))
      .reduce((acc, b) => acc + (b.school_count || 0), 0);
  }, [batches, selectedBatchIds]);

  const activeAgentsCount = useMemo(() => {
    return registry.filter((a) => a.is_implemented).length;
  }, [registry]);

  const totalTargetCount = useMemo(() => {
    return jobs.reduce((acc, j) => acc + (j.target_count || 0), 0);
  }, [jobs]);

  const totalCompletedCount = useMemo(() => {
    return jobs.reduce((acc, j) => acc + (j.completed_count || 0), 0);
  }, [jobs]);

  const overallProgressPercent =
    totalTargetCount > 0 ? Math.round((totalCompletedCount / totalTargetCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* --- Feedback Alert --- */}
      {dispatchFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
            dispatchFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {dispatchFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{dispatchFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* --- Section 1: Dual-Panel Selection Grid (Batches on Left, Agents on Right) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- LEFT PANEL: Batches Selection --- */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 tracking-tight">Select Target Batches</h2>
                <p className="text-[11px] text-slate-500">
                  {selectedBatchIds.length} of {batches.length} selected ({totalSchoolsSelected} schools)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={selectAllBatches}
                disabled={isLoadingBatches || filteredBatches.length === 0}
                className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded-md hover:bg-blue-50 font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={clearBatchesSelection}
                disabled={selectedBatchIds.length === 0}
                className="text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search batches by name..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {batchSearch && (
                <button
                  type="button"
                  onClick={() => setBatchSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Batches List (fixed height for internal scrolling) */}
          <div className="h-96 max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-1">
            {isLoadingBatches ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading batches...</div>
            ) : filteredBatches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {batchSearch ? 'No batches match your search.' : 'No active batches found.'}
              </div>
            ) : (
              filteredBatches.map((batch) => {
                const isSelected = selectedBatchIds.includes(batch.id);
                return (
                  <div
                    key={batch.id}
                    onClick={() => toggleBatchSelection(batch.id)}
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-4.5 h-4.5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {batch.name}
                        </div>
                        {batch.description && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {batch.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {batch.school_count} schools
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          batch.status === 'ready'
                            ? 'bg-emerald-100 text-emerald-800'
                            : batch.status === 'processing'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {batch.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* --- RIGHT PANEL: AI Agents Selection --- */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 tracking-tight">Select AI Agents</h2>
                <p className="text-[11px] text-slate-500">
                  {selectedAgentKeys.length} of {activeAgentsCount} active agents selected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={selectAllActiveAgents}
                disabled={isLoadingRegistry}
                className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded-md hover:bg-blue-50 font-medium transition-colors cursor-pointer"
              >
                Select Active
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={clearAgentsSelection}
                disabled={selectedAgentKeys.length === 0}
                className="text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search agents or target fields..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {agentSearch && (
                <button
                  type="button"
                  onClick={() => setAgentSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Agents List (fixed height for internal scrolling) */}
          <div className="h-96 max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-1">
            {isLoadingRegistry ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading agent registry...</div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No agents match your search.</div>
            ) : (
              filteredAgents.map((agent) => {
                const isSelected = selectedAgentKeys.includes(agent.product_key);
                const isClickable = agent.is_implemented;

                return (
                  <div
                    key={agent.product_key}
                    onClick={() => agent.is_implemented && toggleAgentSelection(agent.product_key)}
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isClickable
                        ? isSelected
                          ? 'bg-blue-50/70 text-slate-900 cursor-pointer'
                          : 'hover:bg-slate-50 text-slate-700 cursor-pointer'
                        : 'bg-slate-50/50 text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-4.5 h-4.5 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : isClickable
                            ? 'border-slate-300 bg-white'
                            : 'border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3 h-3 stroke-[3]" />
                        ) : !isClickable ? (
                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {agent.product_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            v{agent.version}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {agent.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {agent.is_implemented ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* --- Section 2: Action Trigger Bar --- */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {selectedBatchIds.length} Batch(es) ({totalSchoolsSelected} Total Schools) • {selectedAgentKeys.length} Agent(s) Selected
            </div>
            <p className="text-[11px] text-slate-500">
              Ready to execute across target school batches in the background.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Parallel Workers Concurrency Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs w-full sm:w-auto">
            <Sliders className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800">Workers</span>
              <span className="text-[10px] text-slate-500">6.0s spacing</span>
            </div>
            <select
              value={workers}
              onChange={(e) => setWorkers(Number(e.target.value))}
              className="ml-auto text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value={1}>1 Worker</option>
              <option value={2}>2 Workers (Recommended)</option>
              <option value={3}>3 Workers</option>
              <option value={4}>4 Workers</option>
              <option value={5}>5 Workers (Max)</option>
            </select>
          </div>

          {/* Bypass Scraper Cache Toggle */}
          <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                Bypass Cache
                {forceRefresh ? (
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                    Live Crawl (Uses Credits)
                  </span>
                ) : (
                  <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    Cached (0 Credits)
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-500">
                {forceRefresh
                  ? 'Forces fresh Firecrawl extraction from websites'
                  : 'Reuses verified 14-day cached web pages'}
              </span>
            </div>
          </label>

          <button
            type="button"
            onClick={handleStartRunning}
            disabled={isDispatching || selectedBatchIds.length === 0 || selectedAgentKeys.length === 0}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer ${
              forceRefresh
                ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white'
            }`}
          >
            {isDispatching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Dispatching Runs...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Running ({selectedBatchIds.length} Batches, {workers} Workers)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* --- Section 3: Live Job & Batch Progress Monitor --- */}
      {selectedBatchIds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Real-time Execution Monitor
                </h2>
                {hasActiveJob && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    Polling 3s
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring active and queued executions across {selectedBatchIds.length} selected batch(es).
              </p>
            </div>
          </div>

          {/* Aggregate Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Combined Coverage Progress</span>
              <span className="font-bold text-slate-900">
                {totalCompletedCount} / {totalTargetCount} schools processed ({overallProgressPercent}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Job Rows / Cards */}
          <div className="pt-2">
            {jobs.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No active or prior runs recorded for selected batch(es) yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select active agents and batches above and click "Start Running" to trigger the crawl.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {jobs.map((job) => (
                  <div key={job.job_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{job.product_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">[{job.job_id}]</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Agent: <code className="font-mono text-slate-600">{job.agent_id}</code> • Processed {job.completed_count} of {job.target_count} schools
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:self-center self-end flex-wrap justify-end">
                      {/* Status Chip */}
                      {job.status === 'running' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          <span>Running...</span>
                        </span>
                      )}
                      {job.status === 'paused' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                          <Pause className="w-3 h-3 text-amber-700 fill-amber-700" />
                          <span>Paused</span>
                        </span>
                      )}
                      {job.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                          <X className="w-3 h-3 text-slate-500" />
                          <span>Cancelled</span>
                        </span>
                      )}
                      {job.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Queued</span>
                        </span>
                      )}
                      {job.status === 'completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      )}
                      {job.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Failed</span>
                        </span>
                      )}

                      {/* Interactive Job Controls (Pause / Resume / Cancel) */}
                      {job.status === 'running' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePauseJob(job.job_id)}
                            disabled={actionLoadingJobId === job.job_id}
                            title="Pause execution safely"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingJobId === job.job_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Pause className="w-3 h-3 fill-amber-700" />
                            )}
                            <span>Pause</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.job_id)}
                            disabled={actionLoadingJobId === job.job_id}
                            title="Cancel crawl job and reset pending schools"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Square className="w-2.5 h-2.5 fill-rose-700" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      )}

                      {job.status === 'paused' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResumeJob(job.job_id)}
                            disabled={actionLoadingJobId === job.job_id}
                            title={`Resume crawling with ${workers} parallel workers`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingJobId === job.job_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 fill-emerald-800" />
                            )}
                            <span>Resume ({workers}w)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.job_id)}
                            disabled={actionLoadingJobId === job.job_id}
                            title="Cancel crawl job completely"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Square className="w-2.5 h-2.5 fill-rose-700" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      )}

                      {(job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          type="button"
                          onClick={() => handleResumeJob(job.job_id)}
                          disabled={actionLoadingJobId === job.job_id}
                          title="Resume remaining unverified schools"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingJobId === job.job_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Resume ({workers}w)</span>
                        </button>
                      )}

                      <Link
                        to={`/results?batch_id=${job.batch_id}`}
                        className="text-xs font-medium text-slate-600 hover:text-blue-600 underline flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsOperateView;
