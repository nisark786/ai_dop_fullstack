import React, { useState } from 'react';
import { X, Play, ShieldAlert, Cpu, CheckCircle2, Globe, Sparkles } from 'lucide-react';
import type { BatchDetailSchoolItem, RunMetadataAgentRequest, AgentDispatchResponse } from '../../types';
import { api } from '../../services/api';

interface RunMetadataAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  allSchools: BatchDetailSchoolItem[];
  selectedSchoolIds: string[];
  singleSchool?: BatchDetailSchoolItem | null;
  onSuccess: (response: AgentDispatchResponse) => void;
}

export const RunMetadataAgentModal: React.FC<RunMetadataAgentModalProps> = ({
  isOpen,
  onClose,
  batchId,
  batchName,
  allSchools,
  selectedSchoolIds,
  singleSchool,
  onSuccess,
}) => {
  const initialScope: 'single' | 'group' | 'whole_batch' = singleSchool
    ? 'single'
    : selectedSchoolIds.length > 0
    ? 'group'
    : 'whole_batch';

  const [scope, setScope] = useState<'single' | 'group' | 'whole_batch'>(initialScope);
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [workers, setWorkers] = useState<number>(2);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate target schools count
  let targetCount = 0;
  let targetSchoolIds: string[] = [];

  if (scope === 'single') {
    targetCount = singleSchool ? 1 : 0;
    targetSchoolIds = singleSchool ? [singleSchool.school_id] : [];
  } else if (scope === 'group') {
    targetCount = selectedSchoolIds.length;
    targetSchoolIds = selectedSchoolIds;
  } else {
    targetCount = allSchools.length;
    targetSchoolIds = allSchools.map((s) => s.school_id);
  }

  const handleLaunch = async () => {
    if (targetCount === 0) {
      setError('Please select at least one school to run the agent.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: RunMetadataAgentRequest = {
        scope,
        school_ids: scope === 'whole_batch' ? undefined : targetSchoolIds,
        priority,
        force_refresh: forceRefresh,
        workers,
      };

      const response = await api.runMetadataAgent(batchId, payload);
      onSuccess(response);
      onClose();
    } catch (err: any) {
      console.error('Failed to run metadata agent', err);
      setError(err?.message || 'Failed to trigger School Profile Agent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-[#0A1F3C] to-[#12305C] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">School Profile Agent</h3>
                <span className="text-[10px] font-mono bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-semibold">
                  v3.0.4
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Target batch: <span className="font-semibold text-white">{batchName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Engine & Safety Specs */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Reasoning LLM:
              </span>
              <span className="font-mono font-semibold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                gpt-6-luna (OpenAI)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                Discovery & Scraping:
              </span>
              <span className="font-medium text-slate-800">
                Firecrawl (6.0s spacing) + Tavily ISD Resolver
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                Validation Rules:
              </span>
              <span className="font-medium text-slate-800">
                3-Tier Grades, Age≠Grade, Allowed Enums
              </span>
            </div>
          </div>

          {/* Execution Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Execution Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {singleSchool && (
                <button
                  type="button"
                  onClick={() => setScope('single')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scope === 'single'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-800">Single School</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5" title={singleSchool.name}>
                    {singleSchool.name}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setScope('group')}
                disabled={selectedSchoolIds.length === 0}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedSchoolIds.length === 0
                    ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50'
                    : scope === 'group'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-slate-800">Selected ({selectedSchoolIds.length})</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Checked schools</div>
              </button>

              <button
                type="button"
                onClick={() => setScope('whole_batch')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scope === 'whole_batch'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-slate-800">Whole Batch</div>
                <div className="text-[11px] text-slate-500 mt-0.5">All {allSchools.length} schools</div>
              </button>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Queue Priority
            </label>
            <div className="flex items-center gap-3">
              {(['low', 'normal', 'high'] as const).map((p) => (
                <label
                  key={p}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-lg border text-xs font-semibold capitalize cursor-pointer transition-all ${
                    priority === p
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={priority === p}
                    onChange={() => setPriority(p)}
                    className="sr-only"
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Parallel Workers Concurrency */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Parallel Workers
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Global 6.0s spacing safe</span>
            </div>
            <select
              value={workers}
              onChange={(e) => setWorkers(Number(e.target.value))}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value={1}>1 Worker (Sequential / Safest)</option>
              <option value={2}>2 Workers (Recommended Default)</option>
              <option value={3}>3 Workers (Fast)</option>
              <option value={4}>4 Workers (Aggressive)</option>
              <option value={5}>5 Workers (Maximum Throughput)</option>
            </select>
          </div>

          {/* Bypass Scraper Cache Option */}
          <div className="pt-1">
            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors select-none">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Bypass Scraper Cache</span>
                  {forceRefresh ? (
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                      Live Crawl (Uses Credits)
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Cached (0 Credits)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {forceRefresh
                    ? 'Forces fresh Firecrawl extraction directly from school websites.'
                    : 'Reuses verified 14-day cached Markdown pages to save scraper credits.'}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Will process <strong className="text-slate-800">{targetCount}</strong> school{targetCount === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={isSubmitting || targetCount === 0}
              className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Agent</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
