import React from 'react';
import { Layers, Activity, CheckCircle, FileSpreadsheet } from 'lucide-react';
import type { BatchSummaryItem } from '../../types';

interface BatchKpiCardsProps {
  batches: BatchSummaryItem[];
}

export const BatchKpiCards: React.FC<BatchKpiCardsProps> = ({ batches }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card p-5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-blue-600" /> Total Active Batches
        </div>
        <div className="text-3xl font-bold text-[#0A1F3C]">{batches.length}</div>
      </div>
      <div className="card p-5">
        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-amber-600" /> Processing
        </div>
        <div className="text-3xl font-bold text-amber-700">
          {batches.filter((b) => b.status === 'processing').length}
        </div>
      </div>
      <div className="card p-5">
        <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> Completed
        </div>
        <div className="text-3xl font-bold text-emerald-700">
          {batches.filter((b) => b.status === 'completed').length}
        </div>
      </div>
      <div className="card p-5">
        <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Schools Grouped
        </div>
        <div className="text-3xl font-bold text-indigo-900">
          {batches.reduce((sum, b) => sum + b.school_count, 0).toLocaleString()}
        </div>
      </div>
    </div>
  );
};
