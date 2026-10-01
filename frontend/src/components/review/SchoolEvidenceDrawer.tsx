import React from 'react';
import {
  X,
  Building2,
  Globe,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Check,
  RotateCw,
  Quote,
  Undo2,
  Rocket,
} from 'lucide-react';
import type { VerificationSchoolItem } from '../../types';

interface SchoolEvidenceDrawerProps {
  school: VerificationSchoolItem | null;
  isOpen: boolean;
  onClose: () => void;
  queueType: 'verification' | 'approved' | 'recrawl';
  isProcessing: boolean;
  onApprove?: (school: VerificationSchoolItem) => void;
  onReject?: (school: VerificationSchoolItem) => void;
  onUndo?: (school: VerificationSchoolItem) => void;
  onRecrawl?: (school: VerificationSchoolItem) => void;
  onPublish?: (school: VerificationSchoolItem) => void;
}

export const SchoolEvidenceDrawer: React.FC<SchoolEvidenceDrawerProps> = ({
  school,
  isOpen,
  onClose,
  queueType,
  isProcessing,
  onApprove,
  onReject,
  onUndo,
  onRecrawl,
  onPublish,
}) => {
  if (!isOpen || !school) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end transition-opacity animate-in fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50/80">
          <div className="space-y-1 pr-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 truncate">{school.name}</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                  school.status === 'verified' || school.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : school.status === 'rejected'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {school.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {school.district || 'Independent District'} • {school.batch_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Drawer"
            title="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badges / Metrics bar */}
        <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center gap-4 text-xs font-medium text-slate-600">
          {school.dqa_score !== null && school.dqa_score !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">DQA Score:</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">
                {school.dqa_score}/100
              </span>
            </div>
          )}
          {school.confidence_score !== null && school.confidence_score !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Confidence:</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200">
                {school.confidence_score}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Evidence Citations:</span>
            <span className="font-semibold text-slate-800">{school.evidence_count}</span>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* 1. Core Profile Details */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-semibold text-slate-900">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Core Profile & Contact</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Official Website</span>
                {school.website ? (
                  <a
                    href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mt-0.5 truncate"
                  >
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{school.website}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Not extracted</span>
                )}
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Phone Number</span>
                <span className="flex items-center gap-1 font-medium text-slate-800 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>{school.phone || 'N/A'}</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Email Address</span>
                <span className="flex items-center gap-1 font-medium text-slate-800 mt-0.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{school.email || 'N/A'}</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Campus Address</span>
                <span className="flex items-center gap-1 font-medium text-slate-800 mt-0.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{school.address || 'N/A'}</span>
                </span>
              </div>
            </div>

            {school.grades && school.grades.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-medium block mb-1">Grades Served</span>
                <div className="flex flex-wrap gap-1">
                  {school.grades.map((g, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Extracted Audit Recommendations */}
          {school.recommendations && school.recommendations.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Attribute Audit & Recommendations</span>
              </div>

              <div className="space-y-2">
                {school.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wide">
                        {rec.field.replace('_', ' ')}
                      </span>
                      {rec.confidence !== undefined && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                          {rec.confidence}% Conf.
                        </span>
                      )}
                    </div>
                    <div className="text-xs grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block">Current / Input</span>
                        <span className="text-slate-600 line-through text-[11px]">
                          {String(rec.current || 'Empty')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 font-medium block">Recommended</span>
                        <span className="text-emerald-800 font-bold text-[11px]">
                          {String(rec.recommended || 'None')}
                        </span>
                      </div>
                    </div>
                    {rec.reason && (
                      <div className="text-[11px] text-slate-500 italic mt-1">
                        Reason: {rec.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Evidences and Citations */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Quote className="w-4 h-4 text-indigo-600" />
                <span>Evidence Citations ({school.evidences.length})</span>
              </div>
            </div>

            {school.evidences.length === 0 ? (
              <div className="text-slate-400 italic py-3 text-center">
                No citations recorded for this school.
              </div>
            ) : (
              <div className="space-y-3">
                {school.evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                          {ev.field_name}
                        </span>
                        <span className="font-semibold text-slate-800 truncate text-[11px]">
                          {ev.source_name}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[10px]">
                        {ev.confidence_score}% Conf
                      </span>
                    </div>

                    {ev.snippet && (
                      <div className="p-2 bg-white rounded border border-slate-200 text-[11px] text-slate-600 italic">
                        "{ev.snippet}"
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <a
                        href={ev.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-medium truncate max-w-xs"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{ev.source_url}</span>
                      </a>
                      {ev.extracted_at && <span>{ev.extracted_at}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-end gap-3">
          {queueType === 'verification' && (
            <>
              {onReject && (
                <button
                  type="button"
                  onClick={() => onReject(school)}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 rounded-lg font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Reject School</span>
                </button>
              )}
              {onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove(school)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve School</span>
                </button>
              )}
            </>
          )}

          {queueType === 'approved' && (
            <>
              {onUndo && (
                <button
                  type="button"
                  onClick={() => onUndo(school)}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Return to Verification Queue (Undo)</span>
                </button>
              )}
              {onPublish && (
                <button
                  type="button"
                  onClick={() => onPublish(school)}
                  disabled={isProcessing || school.is_published}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{school.is_published ? 'Published to Schools' : 'Publish to Production Schools'}</span>
                </button>
              )}
            </>
          )}

          {queueType === 'recrawl' && (
            <>
              {onUndo && (
                <button
                  type="button"
                  onClick={() => onUndo(school)}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Undo Rejection</span>
                </button>
              )}
              {onRecrawl && (
                <button
                  type="button"
                  onClick={() => onRecrawl(school)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Re-crawl School</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
