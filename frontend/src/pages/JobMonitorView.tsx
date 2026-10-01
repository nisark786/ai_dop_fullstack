import React, { useState, useEffect } from 'react';
import type { CrawlJob, UserRole } from '../types';
import { api } from '../services/api';
import { RotateCw, Zap, AlertCircle, CheckCircle2, Pause, Play, Square, Loader2 } from 'lucide-react';

interface JobMonitorViewProps {
  currentRole: UserRole;
  onFeedback?: (msg: string) => void;
}

export const JobMonitorView: React.FC<JobMonitorViewProps> = ({
  currentRole,
  onFeedback,
}) => {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingJobId, setActionLoadingJobId] = useState<string | null>(null);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch {
      onFeedback?.('Could not load crawl jobs from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // Auto-poll active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'Running' || j.status === 'Pending');
    if (!hasActive) return;
    const interval = setInterval(() => {
      api.getJobs().then(setJobs).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs]);

  const handlePause = async (jobId: string) => {
    setActionLoadingJobId(jobId);
    try {
      onFeedback?.(`Pausing job ${jobId}...`);
      await api.pauseJob(jobId);
      await loadJobs();
      onFeedback?.(`Job ${jobId} paused.`);
    } catch {
      onFeedback?.(`Failed to pause job ${jobId}.`);
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleResume = async (jobId: string) => {
    setActionLoadingJobId(jobId);
    try {
      onFeedback?.(`Resuming job ${jobId}...`);
      await api.resumeJob(jobId);
      await loadJobs();
      onFeedback?.(`Job ${jobId} resumed.`);
    } catch {
      onFeedback?.(`Failed to resume job ${jobId}.`);
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!window.confirm(`Are you sure you want to cancel job ${jobId}? Remaining unverified schools will be reset to pending.`)) return;
    setActionLoadingJobId(jobId);
    try {
      onFeedback?.(`Cancelling job ${jobId}...`);
      await api.cancelJob(jobId);
      await loadJobs();
      onFeedback?.(`Job ${jobId} cancelled.`);
    } catch {
      onFeedback?.(`Failed to cancel job ${jobId}.`);
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleStartNewCrawl = async () => {
    if (currentRole !== 'Admin') {
      onFeedback?.('Only Admins can trigger new crawl requests.');
      return;
    }
    try {
      const res = await api.startJob('MetadataAgent', 'School Profile & Metadata');
      await loadJobs();
      onFeedback?.(res.message || 'Started new crawl job in Supabase.');
    } catch {
      onFeedback?.('Failed to trigger new crawl job.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Running':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'Paused':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Failed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Pending':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Crawl Job Monitor</h1>
          <p className="text-[11px] text-slate-500">
            System Spec Module 5 • Multi-agent web scraping execution, progress & health
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadJobs}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs"
          >
            <RotateCw className={`w-3 h-3 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {currentRole === 'Admin' && (
            <button
              type="button"
              onClick={handleStartNewCrawl}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Start New Crawl Job</span>
            </button>
          )}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                <th className="p-2.5">Job / Request ID</th>
                <th className="p-2.5">Target Product & Agent</th>
                <th className="p-2.5">Progress & Metrics</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-900 font-mono text-xs">{job.id}</div>
                    <span className="text-[10px] text-slate-400">{job.request_id} • {job.created_at || 'Recent'}</span>
                  </td>
                  <td className="p-2.5">
                    <div className="font-medium text-slate-800">{job.product_name}</div>
                    <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                      {job.agent_id}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="text-slate-800 font-medium">
                      {job.records_extracted} records extracted
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {job.schools_processed} schools • {job.exec_time_seconds || job.execution_time_seconds || 0}s execution
                    </span>
                    {job.error_reason && (
                      <div className="inline-flex items-center gap-1 text-[10px] text-rose-600 mt-0.5 truncate max-w-[260px]" title={job.error_reason}>
                        <AlertCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                        <span className="truncate">{job.error_reason}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-2.5">
                    <span
                      className={`text-[9px] uppercase font-semibold px-2 py-0.5 rounded border inline-block ${getStatusBadge(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {job.status === 'Running' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePause(job.id)}
                            disabled={actionLoadingJobId === job.id}
                            title="Pause job safely"
                            className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-medium cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingJobId === job.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Pause className="w-2.5 h-2.5 fill-amber-700" />
                            )}
                            <span>Pause</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(job.id)}
                            disabled={actionLoadingJobId === job.id}
                            title="Cancel crawl job"
                            className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded font-medium cursor-pointer disabled:opacity-50"
                          >
                            <Square className="w-2.5 h-2.5 fill-rose-700" />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}

                      {job.status === 'Paused' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResume(job.id)}
                            disabled={actionLoadingJobId === job.id}
                            title="Resume job execution"
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-medium cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingJobId === job.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Play className="w-2.5 h-2.5 fill-emerald-800" />
                            )}
                            <span>Resume</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(job.id)}
                            disabled={actionLoadingJobId === job.id}
                            title="Cancel crawl job"
                            className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded font-medium cursor-pointer disabled:opacity-50"
                          >
                            <Square className="w-2.5 h-2.5 fill-rose-700" />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}

                      {(job.status === 'Failed' || job.status === 'Cancelled') && (
                        <button
                          type="button"
                          onClick={() => handleResume(job.id)}
                          disabled={actionLoadingJobId === job.id}
                          className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded font-medium cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingJobId === job.id ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <RotateCw className="w-2.5 h-2.5" />
                          )}
                          <span>Resume Job</span>
                        </button>
                      )}

                      {job.status === 'Completed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ERCIE Resolved</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
