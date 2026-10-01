import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCw,
  ExternalLink,
  Sparkles,
  Layers,
  X
} from 'lucide-react';
import { api, type AuditReport } from '../services/api';
import type { School, BatchAuditStatus } from '../types';

export const CrawlPipelinesView: React.FC = () => {
  const [inactiveSchools, setInactiveSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [batchLimit, setBatchLimit] = useState<number>(10);
  const [batchStatus, setBatchStatus] = useState<BatchAuditStatus | null>(null);
  const [activeAuditingId, setActiveAuditingId] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const pollIntervalRef = useRef<any>(null);

  const loadInactiveSchools = async () => {
    setIsLoading(true);
    try {
      const schools = await api.getSchools({ status: 'inactive', limit: 50 });
      setInactiveSchools(schools);
    } catch {
      setNotification('Could not load inactive schools list.');
    } finally {
      setIsLoading(false);
    }
  };

  const pollStatus = async () => {
    try {
      const status = await api.getBatchAuditStatus();
      setBatchStatus(status);
      if (!status.is_running && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        loadInactiveSchools();
      }
    } catch {
      // quiet poll error
    }
  };

  useEffect(() => {
    loadInactiveSchools();
    pollStatus();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleStartBatch = async () => {
    try {
      setNotification(`Dispatching background AI crawl for ${batchLimit} inactive schools...`);
      const res = await api.startBatchAudit(batchLimit);
      setNotification(res.message);

      // Start live polling every 1.5 seconds
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(pollStatus, 1500);
      pollStatus();
    } catch (err: any) {
      setNotification(`Failed to start batch: ${err.message || err}`);
    }
  };

  const handleRunSingleAudit = async (school: School) => {
    setActiveAuditingId(school.id);
    setNotification(`Running 3-Agent DQA Audit on '${school.name}'...`);
    try {
      const report = await api.runSchoolAudit(school.id);
      setAuditReport(report);
      setNotification(`Audit complete for ${school.name}: Score ${report.overall_score}/100. Status: ${report.status_changed_to}`);
      loadInactiveSchools();
    } catch {
      setNotification(`Audit failed for ${school.name}.`);
    } finally {
      setActiveAuditingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
              Active Pipeline
            </span>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              School Metadata Crawling & Reactivation Engine
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            3-Agent Orchestration • Tavily Portal Discovery + Firecrawl Subpage Scraper + GPT-4o Schema Verification
          </p>
        </div>

        {/* Batch Launch Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1">
            <span className="text-[11px] text-slate-400">Batch Size:</span>
            <select
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value))}
              disabled={batchStatus?.is_running}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
            >
              <option value={5}>5 Schools</option>
              <option value={10}>10 Schools</option>
              <option value={25}>25 Schools</option>
              <option value={50}>50 Schools</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleStartBatch}
            disabled={batchStatus?.is_running}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-2xs transition-colors"
          >
            {batchStatus?.is_running ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{batchStatus?.is_running ? 'Batch Crawling Active...' : `Start Batch (${batchLimit})`}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-blue-500 hover:text-blue-700 text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Pipeline Execution Dashboard Card */}
      {batchStatus && (batchStatus.is_running || batchStatus.total > 0) && (
        <div className="bg-slate-900 text-white rounded-lg p-4 border border-slate-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${batchStatus.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {batchStatus.is_running ? 'Crawling In Progress' : 'Batch Complete'}
              </span>
              {batchStatus.current_school_name && (
                <span className="text-xs text-blue-400 font-medium">
                  • Currently Processing: {batchStatus.current_school_name}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Elapsed: {batchStatus.elapsed_seconds}s
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Progress: {batchStatus.processed} of {batchStatus.total} schools</span>
              <span className="font-semibold text-blue-400">{batchStatus.progress_percent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${batchStatus.progress_percent}%` }}
              />
            </div>
          </div>

          {/* Real-Time Outcome Counters */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
            <div className="p-2 bg-slate-800/50 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Processed</div>
              <div className="text-sm font-bold text-white mt-0.5">{batchStatus.processed}</div>
            </div>
            <div className="p-2 bg-emerald-950/40 rounded border border-emerald-800/40">
              <div className="text-[10px] text-emerald-400 uppercase font-semibold">Reactivated (Active)</div>
              <div className="text-sm font-bold text-emerald-300 mt-0.5">{batchStatus.reactivated}</div>
            </div>
            <div className="p-2 bg-amber-950/40 rounded border border-amber-800/40">
              <div className="text-[10px] text-amber-400 uppercase font-semibold">Needs Review</div>
              <div className="text-sm font-bold text-amber-300 mt-0.5">{batchStatus.needs_review}</div>
            </div>
            <div className="p-2 bg-slate-800/50 rounded border border-slate-800">
              <div className="text-[10px] text-rose-400 uppercase font-semibold">Unverified</div>
              <div className="text-sm font-bold text-rose-300 mt-0.5">{batchStatus.unverified}</div>
            </div>
          </div>

          {/* Live Terminal Log Stream */}
          {batchStatus.logs.length > 0 && (
            <div className="bg-black/60 rounded p-2.5 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1 text-slate-300 border border-slate-800">
              {batchStatus.logs.slice().reverse().map((entry, idx) => (
                <div key={idx} className="leading-tight">
                  <span className="text-blue-400">{entry}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Target Queue Table: Inactive Schools Awaiting AI Crawl */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-800">
              Inactive School Crawl Queue ({inactiveSchools.length} loaded from Supabase)
            </h3>
          </div>
          <button
            onClick={loadInactiveSchools}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reload Queue</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                <th className="p-2.5">School Name</th>
                <th className="p-2.5">Location</th>
                <th className="p-2.5">Current Website</th>
                <th className="p-2.5">Active Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    <RotateCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-500" />
                    <span>Loading queue...</span>
                  </td>
                </tr>
              ) : inactiveSchools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No inactive schools found in the database. All schools are currently active!
                  </td>
                </tr>
              ) : (
                inactiveSchools.map((sch) => {
                  const isAuditing = activeAuditingId === sch.id;
                  const displayWebsite = sch.website || sch.url;

                  return (
                    <tr key={sch.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-2.5 font-semibold text-slate-900 max-w-xs truncate" title={sch.name}>
                        {sch.name}
                      </td>

                      <td className="p-2.5 text-slate-500 max-w-[160px] truncate">
                        {sch.city ? `${sch.city}, ${sch.state || 'TX'}` : sch.address || 'Address pending'}
                      </td>

                      <td className="p-2.5 max-w-[200px] truncate">
                        {displayWebsite ? (
                          <a
                            href={displayWebsite}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            <span className="truncate">{displayWebsite.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Missing (Tavily will find)
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border bg-amber-50 text-amber-700 border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Inactive</span>
                        </span>
                      </td>

                      <td className="p-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRunSingleAudit(sch)}
                          disabled={isAuditing || batchStatus?.is_running}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                          <Sparkles className={`w-3 h-3 ${isAuditing ? 'animate-spin' : ''}`} />
                          <span>{isAuditing ? 'Crawling...' : 'Run Single Audit'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Report Modal */}
      {auditReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  DQA Audit Report: {auditReport.school_name || auditReport.school_id}
                </h3>
              </div>
              <button
                onClick={() => setAuditReport(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-200">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Confidence Score</div>
                <div className="text-xl font-bold text-slate-900">{auditReport.overall_score} / 100</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-slate-500">Status Changed To</div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    auditReport.overall_score >= 75
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {auditReport.status_changed_to || (auditReport.overall_score >= 75 ? 'Verified (Active)' : 'Needs Review')}
                </span>
              </div>
            </div>

            {/* Extracted Fields Breakdown */}
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-1.5">Extracted & Verified Fields</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {auditReport.recommendations.map((rec, idx) => (
                  <div key={idx} className="text-xs p-2 bg-slate-50/70 border border-slate-200 rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 capitalize">{rec.field}</span>
                      <span className="text-[10px] text-emerald-600 font-medium">{rec.confidence}% confidence</span>
                    </div>
                    <div className="text-[11px] text-slate-900 mt-0.5 break-all">
                      {String(rec.recommended)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setAuditReport(null)}
              className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 cursor-pointer"
            >
              Close & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
