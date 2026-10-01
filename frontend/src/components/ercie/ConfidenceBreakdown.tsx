import React from 'react';
import type { ConfidenceComponents } from '../../types';

interface ConfidenceBreakdownProps {
  components: ConfidenceComponents;
  confidenceScore: number;
}

export const ConfidenceBreakdown: React.FC<ConfidenceBreakdownProps> = ({
  components,
  confidenceScore,
}) => {
  const items = [
    {
      label: 'Support Strength',
      weight: '40%',
      rawScore: components.support_strength,
      weightedContribution: (components.support_strength * 0.4).toFixed(2),
      desc: 'Winning support / Total support',
      color: 'bg-blue-600',
    },
    {
      label: 'Source Agreement',
      weight: '30%',
      rawScore: components.source_agreement,
      weightedContribution: (components.source_agreement * 0.3).toFixed(2),
      desc: 'Supporting sources / Total sources',
      color: 'bg-indigo-600',
    },
    {
      label: 'Freshness',
      weight: '20%',
      rawScore: components.freshness,
      weightedContribution: (components.freshness * 0.2).toFixed(2),
      desc: 'Source age decay score',
      color: 'bg-emerald-600',
    },
    {
      label: 'Historical Consistency',
      weight: '10%',
      rawScore: components.historical_consistency,
      weightedContribution: (components.historical_consistency * 0.1).toFixed(2),
      desc: '100 × e^(-deviation/100) vs previous',
      color: 'bg-amber-600',
    },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2.5">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <div>
          <span className="font-semibold text-slate-800">ERCIE 4-Component Confidence Breakdown</span>
          <span className="text-[10px] text-slate-500 block">Spec Section 17 & 18 Formulas</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-slate-900">{confidenceScore}%</span>
          <span className="text-[10px] text-slate-500 block">Calculated Confidence</span>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-700">
                {item.label} <span className="text-slate-400 font-normal">({item.weight})</span>
              </span>
              <span className="text-slate-600 font-mono text-[10px]">
                {item.rawScore.toFixed(1)}% × {item.weight} = <strong className="text-slate-900 font-semibold">{item.weightedContribution} pts</strong>
              </span>
            </div>
            {/* Minimal Progress Bar */}
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-300`}
                style={{ width: `${item.rawScore}%` }}
              ></div>
            </div>
            <div className="text-[9px] text-slate-400">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
