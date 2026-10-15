import React, { useEffect, useMemo } from 'react';
import {
  CircleDollarSign,
  Cpu,
  Clock,
  RefreshCw,
  Search,
  Download,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Activity,
  Bot,
  School as SchoolIcon,
} from 'lucide-react';
import { useCostStore } from '../stores/costStore';
import { useAgentStore } from '../stores/agentStore';
import type { CostLogEntry } from '../types';

export const CostMonitorView: React.FC = () => {
  // --- Zustand Store Selectors (Atomic) ---
  const daysPeriod = useCostStore((s) => s.daysPeriod);
  const agentFilter = useCostStore((s) => s.agentFilter);
  const batchFilter = useCostStore((s) => s.batchFilter);
  const currentPage = useCostStore((s) => s.currentPage);
  const pageSize = useCostStore((s) => s.pageSize);
  const summary = useCostStore((s) => s.summary);
  const invocationsData = useCostStore((s) => s.invocationsData);
  const isLoadingSummary = useCostStore((s) => s.isLoadingSummary);
  const isLoadingInvocations = useCostStore((s) => s.isLoadingInvocations);
  const isRefreshing = useCostStore((s) => s.isRefreshing);
  const isExporting = useCostStore((s) => s.isExporting);
  const lastUpdated = useCostStore((s) => s.lastUpdated);

  const setDaysPeriod = useCostStore((s) => s.setDaysPeriod);
  const setAgentFilter = useCostStore((s) => s.setAgentFilter);
  const setBatchFilter = useCostStore((s) => s.setBatchFilter);
  const setCurrentPage = useCostStore((s) => s.setCurrentPage);
  const resetFilters = useCostStore((s) => s.resetFilters);
  const fetchSummary = useCostStore((s) => s.fetchSummary);
  const fetchInvocations = useCostStore((s) => s.fetchInvocations);
  const refreshAll = useCostStore((s) => s.refreshAll);
  const exportAuditCsv = useCostStore((s) => s.exportAuditCsv);

  // --- Check Active Agent Crawling Jobs ---
  const agentJobs = useAgentStore((s) => s.jobs);
  const isAgentCrawling = useMemo(() => {
    return agentJobs.some((j) => j.status === 'running');
  }, [agentJobs]);

  // --- Initial Mount Load ---
  useEffect(() => {
    void fetchSummary();
    void fetchInvocations();
  }, [fetchSummary, fetchInvocations]);

  // --- Execution-Aware Polling Loop (5s when active crawl, 30s when idle) ---
  useEffect(() => {
    const intervalMs = isAgentCrawling ? 5000 : 30000;
    const timer = setInterval(() => {
      void fetchSummary();
      void fetchInvocations();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isAgentCrawling, fetchSummary, fetchInvocations]);

  const totalPages = invocationsData
    ? Math.max(1, Math.ceil(invocationsData.total / pageSize))
    : 1;

  // Compute maximum cost among agents for relative progress bar widths
  const maxAgentCost = useMemo(() => {
    if (!summary || summary.agent_breakdown.length === 0) return 1;
    return Math.max(...summary.agent_breakdown.map((a) => a.total_cost_usd), 0.0001);
  }, [summary]);

  // Token composition percentages
  const tokenComposition = useMemo(() => {
    if (!summary || summary.total_tokens === 0) {
      return { promptPct: 0, completionPct: 0 };
    }
    const prompt = summary.total_prompt_tokens ?? 0;
    const completion = summary.total_completion_tokens ?? 0;
    const total = summary.total_tokens;
    return {
      promptPct: Math.round((prompt / total) * 100),
      completionPct: Math.round((completion / total) * 100),
    };
  }, [summary]);

  return (
    <div className="flex-1 p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Range Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Cost &amp; Token Monitor
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Bot className="w-3 h-3" />
              <span>GPT-6 Luna ($0.10 in / $0.50 out per 1M)</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time OpenAI API cost calculation, token accounting, and per-agent invocation tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time range selector tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-medium">
            <button
              onClick={() => setDaysPeriod(1)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                daysPeriod === 1
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              24 Hours
            </button>
            <button
              onClick={() => setDaysPeriod(7)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                daysPeriod === 7
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDaysPeriod(30)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                daysPeriod === 30
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              30 Days
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => void refreshAll()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Execution-Aware Live Sync Badge */}
          {isAgentCrawling ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Crawling Live (5s)</span>
              <span className="text-emerald-400">·</span>
              <span className="font-mono text-[10px]">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              <span>Idle Sync (30s)</span>
              <span className="text-gray-400">·</span>
              <span className="font-mono text-[10px] text-gray-500">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Cost */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Spend (USD)</span>
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            {isLoadingSummary ? (
              <span className="text-gray-400 text-lg">Loading...</span>
            ) : (
              `$${(summary?.total_cost_usd ?? 0).toFixed(4)}`
            )}
          </div>
          <p className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>Period: <strong>{summary?.period_label || `Last ${daysPeriod} days`}</strong></span>
            <span className="text-emerald-600 font-medium">GPT-6 Luna</span>
          </p>
        </div>

        {/* Card 2: Total Invocations */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">API Invocations</span>
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            {isLoadingSummary ? (
              <span className="text-gray-400 text-lg">Loading...</span>
            ) : (
              `${(summary?.total_calls ?? 0).toLocaleString()} calls`
            )}
          </div>
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <span>Structured outputs &amp; crawler completions</span>
          </p>
        </div>

        {/* Card 3: Total Tokens & Composition */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Tokens Consumed</span>
            <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            {isLoadingSummary ? (
              <span className="text-gray-400 text-lg">Loading...</span>
            ) : (
              (summary?.total_tokens ?? 0).toLocaleString()
            )}
          </div>
          <div className="pt-0.5 flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
              In: {(summary?.total_prompt_tokens ?? 0).toLocaleString()} ({tokenComposition.promptPct}%)
            </span>
            <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
              Out: {(summary?.total_completion_tokens ?? 0).toLocaleString()} ({tokenComposition.completionPct}%)
            </span>
          </div>
        </div>

        {/* Card 4: Avg Cost per Call & Latency */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Cost &amp; Latency</span>
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            {isLoadingSummary ? (
              <span className="text-gray-400 text-lg">Loading...</span>
            ) : (
              `$${(summary?.avg_cost_per_call_usd ?? 0).toFixed(5)}`
            )}
          </div>
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-500" />
            <span>Avg Latency:</span>
            <strong className="text-gray-700">
              {summary?.avg_duration_ms
                ? summary.avg_duration_ms < 1000
                  ? `${Math.round(summary.avg_duration_ms)}ms`
                  : `${(summary.avg_duration_ms / 1000).toFixed(2)}s`
                : '0ms'}
            </strong>
          </p>
        </div>
      </div>

      {/* Agent Breakdown Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Agent Cost &amp; Token Breakdown
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Accumulated token expenditure and average latency grouped by executing AI Agent.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {summary?.agent_breakdown.length ?? 0} active agents
          </span>
        </div>

        {isLoadingSummary ? (
          <div className="py-6 text-center text-sm text-gray-400">Loading breakdown...</div>
        ) : !summary || summary.agent_breakdown.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
            No OpenAI invocations recorded in this period.
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {summary.agent_breakdown.map((agent) => {
              const percentage = summary.total_cost_usd > 0
                ? (agent.total_cost_usd / summary.total_cost_usd) * 100
                : 0;
              const barWidth = `${Math.min(100, Math.max(2, (agent.total_cost_usd / maxAgentCost) * 100))}%`;

              return (
                <div key={agent.agent_name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{agent.agent_name}</span>
                      <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {agent.total_calls} calls
                      </span>
                      <span className="text-[11px] text-gray-400">
                        ({agent.total_tokens.toLocaleString()} tokens · In: {(agent.prompt_tokens ?? 0).toLocaleString()} · Out: {(agent.completion_tokens ?? 0).toLocaleString()})
                      </span>
                      {agent.avg_duration_ms ? (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          {agent.avg_duration_ms < 1000
                            ? `${Math.round(agent.avg_duration_ms)}ms`
                            : `${(agent.avg_duration_ms / 1000).toFixed(2)}s`}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900">
                        ${agent.total_cost_usd.toFixed(4)}
                      </span>
                      <span className="text-[11px] text-gray-400 w-12 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: barWidth }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invocations Table & Filters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search by Agent */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by agent..."
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Search by Batch ID or Name */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Layers className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by batch name or ID..."
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {(agentFilter || batchFilter) && (
              <button
                onClick={resetFilters}
                className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 underline font-medium cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Export Button & Total Count */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Total logs: <strong className="text-gray-900">{invocationsData?.total ?? 0}</strong>
            </span>
            <button
              onClick={() => void exportAuditCsv()}
              disabled={isExporting || !invocationsData || invocationsData.total === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              title="Download full filtered audit log as CSV"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce text-emerald-600' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export Audit CSV'}</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">Time (UTC)</th>
                <th className="py-3 px-4">Agent &amp; Task</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Batch / School</th>
                <th className="py-3 px-4 text-right">Tokens (In / Out / Tot)</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-4 text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-normal">
              {isLoadingInvocations ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Loading invocations...
                  </td>
                </tr>
              ) : !invocationsData || invocationsData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No invocation logs match the current filters.
                  </td>
                </tr>
              ) : (
                invocationsData.items.map((log: CostLogEntry) => {
                  const loggedDate = new Date(log.logged_at);
                  const formattedDate = loggedDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{log.agent_name}</div>
                        {log.task_name && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                            {log.task_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-[11px] border border-emerald-100 font-medium">
                          {log.model}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {/* Resolved Batch Name */}
                          {log.batch_name ? (
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-900 truncate max-w-[200px]" title={`Batch: ${log.batch_name} (${log.batch_id || ''})`}>
                              <Layers className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{log.batch_name}</span>
                            </div>
                          ) : log.batch_id ? (
                            <div className="text-[11px] text-gray-500 font-mono truncate max-w-[160px]" title={log.batch_id}>
                              B: {log.batch_id.slice(0, 14)}...
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}

                          {/* Resolved School Name */}
                          {log.school_name ? (
                            <div className="flex items-center gap-1 text-[10px] text-gray-600 truncate max-w-[200px]" title={`School: ${log.school_name} (${log.school_id || ''})`}>
                              <SchoolIcon className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                              <span className="truncate">{log.school_name}</span>
                            </div>
                          ) : log.school_id ? (
                            <div className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]" title={log.school_id}>
                              S: {log.school_id.slice(0, 14)}...
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-[11px]">
                        <span className="text-gray-500">{log.prompt_tokens.toLocaleString()}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-gray-500">{log.completion_tokens.toLocaleString()}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="font-semibold text-gray-900">{log.total_tokens.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {log.duration_ms < 1000
                          ? `${log.duration_ms}ms`
                          : `${(log.duration_ms / 1000).toFixed(2)}s`}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-emerald-600">
                        ${log.cost_usd.toFixed(5)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div>
            Showing Page <strong className="text-gray-900">{currentPage}</strong> of{' '}
            <strong className="text-gray-900">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoadingInvocations}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white shadow-2xs transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoadingInvocations}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white shadow-2xs transition-colors cursor-pointer"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
