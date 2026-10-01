import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileCode,
  FileSpreadsheet,
  Download,
  RotateCw,
  ExternalLink,
  Building2,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useBatchRunStore } from '../stores/batchRunStore';
import { useAppStore } from '../stores/appStore';

export const BatchRunDetailView: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { data, isLoading } = useBatchRunStore(
    useShallow((s) => ({
      data: s.selectedRun,
      isLoading: s.isLoadingDetail,
    }))
  );
  const fetchRunDetail = useBatchRunStore((s) => s.fetchRunDetail);
  const downloadExport = useBatchRunStore((s) => s.downloadExport);
  const showToast = useAppStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      fetchRunDetail(jobId);
    }
  }, [jobId, fetchRunDetail]);

  const summary = data?.summary;
  const schools = data?.schools || [];

  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.school_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || s.verification_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [schools, searchQuery, statusFilter]);

  // Export handlers
  const handleDownloadHtml = async () => {
    if (!jobId || !summary) return;
    setIsExporting('html');
    try {
      await downloadExport(jobId, 'html');
      showToast('HTML report exported successfully.', 'success');
    } catch {
      showToast('Export HTML failed', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadExcel = async () => {
    if (!jobId || !summary) return;
    setIsExporting('excel');
    try {
      await downloadExport(jobId, 'excel');
      showToast('Excel report exported successfully.', 'success');
    } catch {
      showToast('Export Excel failed', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadCsv = async () => {
    if (!jobId || !summary) return;
    setIsExporting('csv');
    try {
      await downloadExport(jobId, 'csv');
      showToast('CSV report exported successfully.', 'success');
    } catch {
      showToast('Export CSV failed', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const formatFieldName = (name: string): string => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs">
        <RotateCw className="w-6 h-6 mx-auto animate-spin mb-3 text-blue-600" />
        <span>Loading batch run execution output...</span>
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="text-sm font-bold text-slate-800">Run Not Found</div>
        <p className="text-xs text-slate-500">
          Could not find execution details for job "{jobId}".
        </p>
        <Link
          to="/runs"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Pipeline Runs</span>
        </Link>
      </div>
    );
  }

  const verifiedRate = summary.total_schools
    ? Math.round((summary.verified_count / summary.total_schools) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Top Navigation & Back Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/runs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Pipeline Runs</span>
        </Link>
      </div>

      {/* Hero Header Banner */}
      <div className="bg-[#0A1F3C] text-white rounded-2xl p-6 shadow-md border border-[#1B3F73]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-blue-300 uppercase">
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Pipeline Run Output</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              {summary.batch_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-2">
              <span className="font-mono bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-md font-semibold">
                {summary.job_id}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {summary.created_at}
              </span>
              <span>•</span>
              <span>Agent: <strong>{summary.agent_name} (v{summary.agent_version})</strong></span>
              <span>•</span>
              <span>Model: <strong>gpt-6-luna</strong></span>
            </div>
          </div>

          {/* Export Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* HTML Report */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              disabled={isExporting !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
              title="Download standalone, self-contained HTML report with CSS embedded"
            >
              <FileCode className="w-4 h-4" />
              <span>{isExporting === 'html' ? 'Exporting...' : 'Download HTML Report'}</span>
            </button>

            {/* Excel (.xlsx) */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isExporting !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
              title="Download styled Excel spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting === 'excel' ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>

            {/* CSV */}
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={isExporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/20 active:bg-white/25 disabled:opacity-50 cursor-pointer transition-all"
              title="Download comma-separated values"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting === 'csv' ? 'Exporting...' : 'CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Schools</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{summary.total_schools}</div>
          <div className="text-[10px] text-slate-400">Processed in this batch run</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Verified Rate</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{verifiedRate}%</div>
          <div className="text-[10px] text-slate-400">{summary.verified_count} of {summary.total_schools} verified</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Average DQA Score</div>
          <div className="text-xl font-bold text-blue-700 mt-0.5">{summary.avg_score}%</div>
          <div className="text-[10px] text-slate-400">Multi-attribute confidence</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cache Hits</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{summary.cache_hits_total}</div>
          <div className="text-[10px] text-slate-400">Firecrawl credits conserved</div>
        </div>
      </div>

      {/* Schools Section */}
      <div className="space-y-3">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search school name or address..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Status:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({schools.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('verified')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'verified'
                    ? 'bg-white text-emerald-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Verified ({summary.verified_count})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('needs_review')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  statusFilter === 'needs_review'
                    ? 'bg-white text-amber-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Needs Review ({summary.needs_review_count})
              </button>
            </div>
          </div>
        </div>

        {/* School Cards List */}
        <div className="space-y-3">
          {filteredSchools.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
              No schools match your filter criteria.
            </div>
          ) : (
            filteredSchools.map((s, idx) => {
              const isVerified = s.verification_status === 'verified';
              const ext = s.extracted_fields || {};
              const recs = s.recommendations || [];

              return (
                <div
                  key={s.school_id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 hover:border-slate-300 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm font-bold text-slate-900">{s.school_name}</h3>
                      {s.website && (
                        <a
                          href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Website</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {s.overall_score}% Score
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isVerified ? 'Verified' : 'Needs Review'}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Fields Matrix */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Telephone
                      </span>
                      <span className="text-slate-800 font-medium">{ext.phone || '—'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Email Address
                      </span>
                      <span className="text-slate-800 font-medium">{ext.email || '—'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Grades Offered
                      </span>
                      <span className="text-slate-800 font-medium">
                        {Array.isArray(ext.grades) ? ext.grades.join(', ') : ext.grades || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Open Enrollment
                      </span>
                      <span className="text-slate-800 font-medium">
                        {ext.open_enrollment === true
                          ? 'Yes'
                          : ext.open_enrollment === false
                          ? 'No'
                          : '—'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Campus Address
                      </span>
                      <span className="text-slate-800 font-medium">
                        {ext.address || s.address || '—'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Programs / Models
                      </span>
                      <span className="text-slate-800 font-medium">
                        {Array.isArray(ext.extracurricular_programs)
                          ? ext.extracurricular_programs.join(', ')
                          : ext.extracurricular_programs || '—'}
                      </span>
                    </div>

                    {ext.description && (
                      <div className="col-span-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Factual Description
                        </span>
                        <p className="text-slate-700 text-xs mt-0.5 leading-relaxed">
                          {ext.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Recommendations Callout */}
                  {recs.length > 0 && (
                    <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg text-xs space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                        Audit Recommendations ({recs.length}):
                      </div>
                      <ul className="space-y-0.5 pl-3 list-disc text-slate-700 text-[11px]">
                        {recs.map((r, rIdx) => (
                          <li key={rIdx}>
                            <strong>{formatFieldName(r.field)}</strong>: {String(r.recommended)}{' '}
                            <span className="text-slate-400">
                              ({Math.round((r.confidence <= 1 ? r.confidence * 100 : r.confidence))}% confidence)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Pages Crawled: {s.pages_crawled_count} • Cache Hits: {s.cache_hits_count}</span>
                    <span>Extracted: {s.crawled_at}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
