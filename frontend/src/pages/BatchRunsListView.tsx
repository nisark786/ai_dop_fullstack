import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  RotateCw,
  Search,
  CheckCircle2,
  FileCode,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Layers,
  Sparkles,
  Eye,
  Building2,
  Calendar,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useBatchRunStore } from '../stores/batchRunStore';
import { useAppStore } from '../stores/appStore';
import type { BatchRunSummary } from '../types';

export const BatchRunsListView: React.FC = () => {
  const { runs, isLoading } = useBatchRunStore(
    useShallow((s) => ({
      runs: s.runs,
      isLoading: s.isLoadingRuns,
    }))
  );
  const fetchRuns = useBatchRunStore((s) => s.fetchRuns);
  const downloadExport = useBatchRunStore((s) => s.downloadExport);
  const showToast = useAppStore((s) => s.showToast);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const filteredRuns = useMemo(() => {
    if (!searchQuery.trim()) return runs;
    const q = searchQuery.toLowerCase();
    return runs.filter(
      (r) =>
        r.job_id.toLowerCase().includes(q) ||
        r.batch_name.toLowerCase().includes(q) ||
        r.agent_name.toLowerCase().includes(q)
    );
  }, [runs, searchQuery]);

  // Overall KPIs
  const totalSchoolsProcessed = useMemo(
    () => runs.reduce((acc, r) => acc + (r.total_schools || 0), 0),
    [runs]
  );
  const totalVerified = useMemo(
    () => runs.reduce((acc, r) => acc + (r.verified_count || 0), 0),
    [runs]
  );
  const totalCacheHits = useMemo(
    () => runs.reduce((acc, r) => acc + (r.cache_hits_total || 0), 0),
    [runs]
  );
  const overallVerifiedRate = totalSchoolsProcessed
    ? Math.round((totalVerified / totalSchoolsProcessed) * 100)
    : 0;

  // Export Handlers
  const handleDownloadHtml = async (run: BatchRunSummary) => {
    setDownloadingJobId(run.job_id);
    try {
      await downloadExport(run.job_id, 'html');
      showToast(`Exported HTML report for ${run.batch_name}`, 'success');
    } catch {
      showToast('Failed to download HTML', 'error');
    } finally {
      setDownloadingJobId(null);
    }
  };

  const handleDownloadExcel = async (run: BatchRunSummary) => {
    setDownloadingJobId(run.job_id);
    try {
      await downloadExport(run.job_id, 'excel');
      showToast(`Exported Excel report for ${run.batch_name}`, 'success');
    } catch {
      showToast('Failed to download Excel', 'error');
    } finally {
      setDownloadingJobId(null);
    }
  };

  const handleDownloadCsv = async (run: BatchRunSummary) => {
    setDownloadingJobId(run.job_id);
    try {
      await downloadExport(run.job_id, 'csv');
      showToast(`Exported CSV report for ${run.batch_name}`, 'success');
    } catch {
      showToast('Failed to download CSV', 'error');
    } finally {
      setDownloadingJobId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Pipeline Runs & Execution History
            </h1>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {runs.length} {runs.length === 1 ? 'Run' : 'Runs'} Logged
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit historical batch execution runs, inspect per-school extracted fields, and export standalone reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchRuns}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Runs</span>
            <History className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{runs.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Completed pipeline executions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Schools Processed</span>
            <Building2 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalSchoolsProcessed}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total school extractions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verified Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{overallVerifiedRate}%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{totalVerified} of {totalSchoolsProcessed} verified</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cache Hits</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalCacheHits}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Scraper credits saved</div>
        </div>
      </div>

      {/* Runs Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Job ID, Batch Name, or Agent..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          <div className="text-[11px] text-slate-500">
            Showing <strong className="text-slate-800">{filteredRuns.length}</strong> of {runs.length} runs
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4 w-[130px]">Run ID</th>
                <th className="py-2.5 px-4">Batch</th>
                <th className="py-2.5 px-4 w-[170px]">Execution Time</th>
                <th className="py-2.5 px-4 w-[120px] text-center">Schools</th>
                <th className="py-2.5 px-4 w-[180px]">Verification Results</th>
                <th className="py-2.5 px-4 w-[90px] text-center">Avg Score</th>
                <th className="py-2.5 px-4 w-[100px] text-center">Status</th>
                <th className="py-2.5 px-4 w-[170px] text-right">Actions & Exports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <RotateCw className="w-5 h-5 mx-auto animate-spin mb-2 text-slate-400" />
                    Loading execution runs...
                  </td>
                </tr>
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No pipeline runs found.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => {
                  const verifiedRate = run.total_schools
                    ? Math.round((run.verified_count / run.total_schools) * 100)
                    : 0;

                  return (
                    <tr key={run.job_id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Run ID */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        <Link
                          to={`/runs/${run.job_id}`}
                          className="hover:underline flex items-center gap-1"
                          title="Open detailed run output"
                        >
                          <span>{run.job_id}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                      </td>

                      {/* Batch */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{run.batch_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {run.agent_name}
                        </div>
                      </td>

                      {/* Execution Time */}
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{run.created_at || 'Recently'}</span>
                        </div>
                      </td>

                      {/* Schools Count */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {run.total_schools} {run.total_schools === 1 ? 'school' : 'schools'}
                        </span>
                      </td>

                      {/* Verification Split Bar */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-semibold text-emerald-700">
                              {run.verified_count} Verified ({verifiedRate}%)
                            </span>
                            {run.needs_review_count > 0 && (
                              <span className="text-amber-700 font-medium">
                                {run.needs_review_count} Review
                              </span>
                            )}
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${verifiedRate}%` }}
                              className="bg-emerald-500 h-full rounded-full"
                            />
                            {run.needs_review_count > 0 && (
                              <div
                                style={{ width: `${100 - verifiedRate}%` }}
                                className="bg-amber-400 h-full"
                              />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Avg Score */}
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${
                            run.avg_score >= 75
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {run.avg_score}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Done</span>
                        </span>
                      </td>

                      {/* Actions & Exports */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Open Details */}
                          <Link
                            to={`/runs/${run.job_id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-700 hover:text-blue-600 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs"
                            title="Inspect Run Output"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Inspect</span>
                          </Link>

                          {/* Download HTML */}
                          <button
                            type="button"
                            onClick={() => handleDownloadHtml(run)}
                            disabled={downloadingJobId === run.job_id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-700 hover:bg-emerald-50 bg-white border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                            title="Download Standalone HTML Report (Shareable via email)"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                            <span>HTML</span>
                          </button>

                          {/* Download Excel */}
                          <button
                            type="button"
                            onClick={() => handleDownloadExcel(run)}
                            disabled={downloadingJobId === run.job_id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-700 hover:bg-blue-50 bg-white border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                            title="Download Excel Workbook (.xlsx)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Excel</span>
                          </button>

                          {/* Download CSV */}
                          <button
                            type="button"
                            onClick={() => handleDownloadCsv(run)}
                            disabled={downloadingJobId === run.job_id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 bg-white border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                            title="Download CSV file"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>CSV</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
