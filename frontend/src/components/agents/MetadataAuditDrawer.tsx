import React from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  FileText,
  Play,
  Info,
} from 'lucide-react';
import type { BatchDetailSchoolItem, MetadataRecommendation } from '../../types';

interface MetadataAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  school: BatchDetailSchoolItem | null;
  onRunAgent: (school: BatchDetailSchoolItem) => void;
}

export const MetadataAuditDrawer: React.FC<MetadataAuditDrawerProps> = ({
  isOpen,
  onClose,
  school,
  onRunAgent,
}) => {
  if (!isOpen || !school) return null;

  const infoData = school.products?.info;
  const status = infoData?.status || 'not_run';
  const score = infoData?.score !== undefined ? infoData.score : null;
  const recommendations: MetadataRecommendation[] = infoData?.recommendations || [];
  const jobId = infoData?.job_id;
  const completedAt = infoData?.completed_at;

  const getStatusBadge = () => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified ({score ?? 90}%)
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs Review ({score ?? 45}%)
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Running...
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5" />
            Queued
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Info className="w-3.5 h-3.5" />
            Not Run
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-[#0A1F3C] text-white flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-blue-300 font-bold">
                Product 1: School Profile & Metadata
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded font-mono">
                gpt-6-luna
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{school.name}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              {school.district && <span>{school.district}</span>}
              {school.state && <span>· {school.state}</span>}
              {school.website && (
                <a
                  href={school.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 hover:text-white inline-flex items-center gap-1 hover:underline"
                >
                  <span className="truncate max-w-[200px]">{school.website}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status & Score Banner */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Verification Status
              </div>
              <div className="flex items-center gap-3">{getStatusBadge()}</div>
            </div>

            {jobId && (
              <div className="text-right text-xs text-slate-500">
                <div>
                  Job: <span className="font-mono font-bold text-slate-700">{jobId}</span>
                </div>
                {completedAt && (
                  <div className="text-[11px] text-slate-400">
                    {new Date(completedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* If Not Run */}
          {status === 'not_run' && (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
              <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Audit Not Yet Run</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Launch the School Profile Agent to scrape the official portal, check identity, enforce
                grades hierarchy, and validate contact details.
              </p>
              <button
                type="button"
                onClick={() => onRunAgent(school)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Agent for {school.name}</span>
              </button>
            </div>
          )}

          {/* If Running */}
          {status === 'running' && (
            <div className="p-6 rounded-xl border border-blue-200 bg-blue-50/50 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <div className="text-sm font-bold text-blue-900">Auditing School Profile...</div>
              <p className="text-xs text-blue-700 max-w-md mx-auto">
                Firecrawl is safely scraping subpages with 6.0s spacing, while Tavily and gpt-6-luna
                verify grade hierarchies and accreditation.
              </p>
            </div>
          )}

          {/* Recommendations Table & Field Audits */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Field Audit Recommendations ({recommendations.length})
                </h4>
              </div>

              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-slate-100 text-slate-700">
                        {rec.field}
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        {Math.round(rec.confidence * 100)}% Confidence
                      </span>
                    </div>

                    {/* Value diff */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-100 text-rose-900">
                        <span className="font-semibold text-rose-500 block text-[10px] uppercase">Current</span>
                        <span className="font-mono break-all">{String(rec.current ?? 'null')}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-emerald-900">
                        <span className="font-semibold text-emerald-500 block text-[10px] uppercase">Recommended</span>
                        <span className="font-mono break-all font-semibold">
                          {Array.isArray(rec.recommended)
                            ? rec.recommended.join(', ')
                            : String(rec.recommended ?? 'null')}
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    {rec.reason && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                        "{rec.reason}"
                      </p>
                    )}

                    {/* Evidence Sources */}
                    {rec.sources && rec.sources.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Supporting Evidence ({rec.sources.length})
                        </span>
                        {rec.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2 rounded bg-slate-50 border border-slate-200 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-slate-700">{src.page || 'Source'}</span>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono text-[10px]"
                              >
                                <span>{src.url.replace(/^https?:\/\//, '').slice(0, 30)}...</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                            <blockquote className="text-[11px] text-slate-600 border-l-2 border-blue-400 pl-2 italic">
                              "{src.text}"
                            </blockquote>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* School Attributes Review */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              School Profile Attributes
            </h4>

            <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 text-xs">
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Name:</span>
                <span className="font-semibold text-slate-800 text-right">{school.name}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Website:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[280px]">
                  {school.website || 'Not specified'}
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Address:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[280px]">
                  {school.address || 'Not specified'}
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">District:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {school.district || 'Not specified'}
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">State:</span>
                <span className="font-semibold text-slate-800 text-right">{school.state || 'TX'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRunAgent(school);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Re-Audit School</span>
          </button>
        </div>
      </div>
    </div>
  );
};
