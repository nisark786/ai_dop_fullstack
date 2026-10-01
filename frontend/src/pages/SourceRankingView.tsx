import React, { useEffect } from 'react';
import type { UserRole } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { useGovernanceStore } from '../stores/governanceStore';
import { useAppStore } from '../stores/appStore';
import { TrendingDown, CheckCircle2, Calculator, RotateCw } from 'lucide-react';

interface SourceRankingViewProps {
  currentRole: UserRole;
  onFeedback?: (msg: string) => void;
}

export const SourceRankingView: React.FC<SourceRankingViewProps> = ({
  currentRole,
  onFeedback,
}) => {
  const { sources, isLoading } = useGovernanceStore(
    useShallow((s) => ({
      sources: s.sources,
      isLoading: s.isLoadingSources,
    }))
  );
  const fetchSources = useGovernanceStore((s) => s.fetchSources);
  const updateSourceWeight = useGovernanceStore((s) => s.updateSourceWeight);
  const showToast = useAppStore((s) => s.showToast);
  const notify = onFeedback || ((msg: string) => showToast(msg, 'info'));

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleWeightChange = async (id: string, newBaseline: number) => {
    if (currentRole !== 'Admin') {
      notify('Only Admins can reconfigure source baseline weights.');
      return;
    }
    const ok = await updateSourceWeight(id, newBaseline);
    if (ok) {
      notify(`Updated configured weight for source ${id}. Effective weight recalculated in Supabase.`);
    } else {
      notify(`Failed to update weight for ${id}.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            Dynamic Source Ranking & Accuracy Engine
          </h1>
          <p className="text-[11px] text-slate-500">
            System Spec Module 7 & 19 • Historical accuracy feedback loops & dynamic weight drift
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSources}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs"
          >
            <RotateCw className={`w-3 h-3 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2.5 py-1 text-[11px] text-blue-800">
            <Calculator className="w-3 h-3 text-blue-600" />
            <span>Formula: <code className="font-bold">Effective Weight = Baseline × (Accuracy / 100)</code></span>
          </div>
        </div>
      </div>

      {/* Source Ranking Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                <th className="p-2.5">Source / Category</th>
                <th className="p-2.5">Configured Baseline</th>
                <th className="p-2.5">Review Decisions (App / Corr / Rej)</th>
                <th className="p-2.5">Historical Accuracy</th>
                <th className="p-2.5 font-bold text-slate-900">Effective Weight</th>
                <th className="p-2.5">Drift Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((src) => {
                const isDriftingDown = src.effective_weight < src.configured_weight * 0.6;
                return (
                  <tr key={src.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">{src.source_name}</div>
                      <span className="text-[10px] text-slate-400">{src.category}</span>
                    </td>
                    <td className="p-2.5">
                      {currentRole === 'Admin' ? (
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={src.configured_weight}
                          onChange={(e) => handleWeightChange(src.id, Number(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 font-semibold text-center"
                        />
                      ) : (
                        <span className="font-semibold text-slate-800">{src.configured_weight}</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <div className="text-slate-800 text-[11px]">
                        <span className="text-emerald-700 font-semibold">{src.approved_ct}</span> /{' '}
                        <span className="text-blue-700 font-semibold">{src.corrected_ct}</span> /{' '}
                        <span className="text-rose-700 font-semibold">{src.rejected_ct}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Total {src.total_reviews} reviews</span>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{src.historical_accuracy.toFixed(1)}%</span>
                      </div>
                      <span className="text-[9px] text-slate-400">Corrected = 0.5 credit</span>
                    </td>
                    <td className="p-2.5">
                      <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {src.effective_weight.toFixed(1)}
                      </span>
                    </td>
                    <td className="p-2.5">
                      {isDriftingDown ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium">
                          <TrendingDown className="w-3 h-3 text-rose-600" />
                          <span>Drifting Down (-{(src.configured_weight - src.effective_weight).toFixed(1)})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>High Fidelity</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
