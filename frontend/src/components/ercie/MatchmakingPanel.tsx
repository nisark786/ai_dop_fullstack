import React from 'react';
import type { ValueGroup, EvidenceCandidate } from '../../types';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface MatchmakingPanelProps {
  valueGroups: ValueGroup[];
  candidates: EvidenceCandidate[];
  winningValue: string;
}

export const MatchmakingPanel: React.FC<MatchmakingPanelProps> = ({
  valueGroups,
  candidates,
  winningValue,
}) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-3">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <div>
          <span className="font-semibold text-slate-800">Evidence Resolution Matchmaking</span>
          <span className="text-[10px] text-slate-500 block">Spec Section 16 • Source Score = Trust × Accuracy</span>
        </div>
        <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-2 py-0.5 rounded font-medium">
          <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
          <span>Source Conflict Detected</span>
        </div>
      </div>

      {/* Value Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {valueGroups.map((group) => {
          const isWinner = group.value === winningValue;
          return (
            <div
              key={group.value}
              className={`p-2.5 rounded border transition-colors ${
                isWinner
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400/20'
                  : 'bg-white border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    Value: {group.value}
                  </span>
                  {isWinner && (
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Winning Value</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-slate-700">
                  {(group.evidence_support ?? group.total_support ?? 0).toFixed(2)} pts
                </span>
              </div>

              <div className="text-[10px] text-slate-600 space-y-1">
                <div>
                  <strong className="text-slate-700">Sources:</strong> {(group.supporting_sources ?? group.sources ?? []).join(', ')}
                </div>
                <div className="text-[9px] text-slate-400">
                  Calculated Evidence Support = Σ(Trust Weight × Accuracy)
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw Extracted Candidate Evidence Table */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
          Candidate Extraction Provenance (Section 11.4)
        </span>
        <div className="overflow-x-auto border border-slate-200 rounded bg-white">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="p-1.5 font-medium">Source / Category</th>
                <th className="p-1.5 font-medium">Extracted Value</th>
                <th className="p-1.5 font-medium">Trust Weight</th>
                <th className="p-1.5 font-medium">Accuracy</th>
                <th className="p-1.5 font-medium">Score</th>
                <th className="p-1.5 font-medium">Provenance URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((cand) => {
                const rawSnippet = (cand as any).raw_extracted_text;
                const sourceUrl = cand.source_url || cand.provenance_url || '#';
                const accuracy = cand.historical_accuracy ?? cand.confidence_score ?? 95;
                const score = cand.source_score ?? cand.confidence_score ?? 95;
                const val = cand.field_value || cand.extracted_value || '';

                return (
                  <React.Fragment key={cand.id || sourceUrl}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-1.5 font-medium text-slate-800">
                        <div>{cand.source_name}</div>
                        <span className="text-[9px] text-slate-400 font-normal">{cand.source_category}</span>
                      </td>
                      <td className="p-1.5 font-mono font-semibold text-slate-900">{val}</td>
                      <td className="p-1.5 text-slate-600">{cand.trust_weight ?? 100}</td>
                      <td className="p-1.5 text-slate-600">{accuracy}%</td>
                      <td className="p-1.5 font-semibold text-slate-800">{Number(score).toFixed(1)}</td>
                      <td className="p-1.5">
                        {sourceUrl !== '#' ? (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline truncate max-w-[160px]"
                            title={sourceUrl}
                          >
                            <span className="truncate">{sourceUrl}</span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400">Direct Scrape</span>
                        )}
                      </td>
                    </tr>
                    {rawSnippet && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={6} className="p-2 border-t border-slate-100">
                          <div className="text-[9px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                            <span className="font-semibold text-slate-700 block mb-0.5">Verbatim Scraped Evidence:</span>
                            <span className="italic font-mono whitespace-pre-wrap leading-relaxed">"{rawSnippet}"</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
