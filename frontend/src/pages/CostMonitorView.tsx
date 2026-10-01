import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { api } from '../services/api';
import type { CostSummary, CostInvocationsResponse, CostLogEntry } from '../types';

export const CostMonitorView: React.FC = () => {
  // --- Filter & Time Range States ---
  const [daysPeriod, setDaysPeriod] = useState<number>(7);
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // --- Data States ---
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [invocationsData, setInvocationsData] = useState<CostInvocationsResponse | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [isLoadingInvocations, setIsLoadingInvocations] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // --- Fetch Summary Metrics ---
  const fetchSummaryData = useCallback(async (days: number) => {
    try {
      const data = await api.getCostSummary(days);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load cost summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // --- Fetch Granular Invocations ---
  const fetchInvocations = useCallback(
    async (page: number, agent?: string, batch?: string) => {
      setIsLoadingInvocations(true);
      try {
        const data = await api.getCostInvocations({
          page,
          page_size: pageSize,
          agent_name: agent ? agent.trim() : undefined,
          batch_id: batch ? batch.trim() : undefined,
        });
        setInvocationsData(data);
      } catch (err) {
        console.error('Failed to load cost invocations:', err);
      } finally {
        setIsLoadingInvocations(false);
      }
    },
    [pageSize]
  );

  // --- Initial & Filter Triggered Load ---
  useEffect(() => {
    fetchSummaryData(daysPeriod);
  }, [daysPeriod, fetchSummaryData]);

  useEffect(() => {
    fetchInvocations(currentPage, agentFilter, batchFilter);
  }, [currentPage, agentFilter, batchFilter, fetchInvocations]);

  // --- Automatic 10s Polling Loop ---
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSummaryData(daysPeriod);
      fetchInvocations(currentPage, agentFilter, batchFilter);
      setLastUpdated(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, [daysPeriod, currentPage, agentFilter, batchFilter, fetchSummaryData, fetchInvocations]);

  // --- Manual Refresh Handler ---
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchSummaryData(daysPeriod),
      fetchInvocations(currentPage, agentFilter, batchFilter),
    ]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // --- CSV Export Handler ---
  const handleExportCsv = () => {
    if (!invocationsData || invocationsData.items.length === 0) return;

    const headers = [
      'ID',
      'Logged At',
      'Agent',
      'Model',
      'Task',
      'Batch ID',
      'School ID',
      'Prompt Tokens',
      'Completion Tokens',
      'Total Tokens',
      'Cost (USD)',
      'Duration (ms)',
    ];

    const rows = invocationsData.items.map((item: CostLogEntry) => [
      item.id,
      item.logged_at,
      item.agent_name,
      item.model,
      item.task_name || '',
      item.batch_id || '',
      item.school_id || '',
      item.prompt_tokens,
      item.completion_tokens,
      item.total_tokens,
      item.cost_usd,
      item.duration_ms,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `openai_cost_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = invocationsData
    ? Math.max(1, Math.ceil(invocationsData.total / pageSize))
    : 1;

  // Compute maximum cost among agents for relative progress bar widths
  const maxAgentCost = useMemo(() => {
    if (!summary || summary.agent_breakdown.length === 0) return 1;
    return Math.max(...summary.agent_breakdown.map((a) => a.total_cost_usd), 0.0001);
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
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time OpenAI API cost calculation, token accounting, and per-agent invocation tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time range selector tabs */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-medium">
            <button
              onClick={() => {
                setDaysPeriod(1);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                daysPeriod === 1
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              24 Hours
            </button>
            <button
              onClick={() => {
                setDaysPeriod(7);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${
                daysPeriod === 7
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => {
                setDaysPeriod(30);
                setCurrentPage(1);
              }}
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
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Live auto-refresh pulse */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Sync (10s)</span>
            <span className="text-emerald-500">·</span>
            <span className="font-mono text-[10px] text-emerald-600">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Cost */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total LLM Cost</span>
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
          <p className="text-[11px] text-gray-500 flex items-center gap-1">
            <span>Period:</span>
            <span className="font-medium text-gray-700">{summary?.period_label || 'Last 7 days'}</span>
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
            <span>Structured outputs &amp; chat calls</span>
          </p>
        </div>

        {/* Card 3: Total Tokens */}
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
          <p className="text-[11px] text-gray-500">
            Prompt + Completion token footprint
          </p>
        </div>

        {/* Card 4: Avg Cost per Call */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Cost / Call</span>
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
          <p className="text-[11px] text-gray-500">
            Weighted across all agent executions
          </p>
        </div>
      </div>

      {/* Agent Breakdown Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Agent Cost Breakdown
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Accumulated token expenditure grouped by executing AI Agent.
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
                        ({agent.total_tokens.toLocaleString()} tokens)
                      </span>
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
                onChange={(e) => {
                  setAgentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Search by Batch ID */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Layers className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by batch ID..."
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {(agentFilter || batchFilter) && (
              <button
                onClick={() => {
                  setAgentFilter('');
                  setBatchFilter('');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 underline font-medium"
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
              onClick={handleExportCsv}
              disabled={!invocationsData || invocationsData.items.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
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
                invocationsData.items.map((log) => {
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[11px]">
                          {log.model}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {log.batch_id ? (
                            <div className="text-[11px] text-gray-600 font-mono truncate max-w-[160px]" title={log.batch_id}>
                              B: {log.batch_id.slice(0, 14)}...
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                          {log.school_id && (
                            <div className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]" title={log.school_id}>
                              S: {log.school_id.slice(0, 14)}...
                            </div>
                          )}
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
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoadingInvocations}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white shadow-2xs transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
