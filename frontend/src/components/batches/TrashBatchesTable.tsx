import React from 'react';
import { Trash2, Clock, RotateCcw } from 'lucide-react';
import type { BatchSummaryItem } from '../../types';

interface TrashBatchesTableProps {
  trashBatches: BatchSummaryItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  onRestore: (batch: BatchSummaryItem) => void;
  onDeletePermanent: (batch: BatchSummaryItem) => void;
}

export const TrashBatchesTable: React.FC<TrashBatchesTableProps> = ({
  trashBatches,
  isLoading,
  isSubmitting,
  onRestore,
  onDeletePermanent,
}) => {
  return (
    <table className="w-full text-left text-sm whitespace-nowrap">
      <thead className="bg-[#FFF5F5] border-b border-[#FEE2E2] text-rose-700 uppercase text-[11px] font-semibold tracking-wider">
        <tr>
          <th className="px-6 py-3.5">Batch Name</th>
          <th className="px-6 py-3.5">Source</th>
          <th className="px-6 py-3.5 text-center">Schools</th>
          <th className="px-6 py-3.5">Deleted On</th>
          <th className="px-6 py-3.5">Retention Status</th>
          <th className="px-6 py-3.5 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#EEF2F7] bg-white">
        {isLoading ? (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                <p className="text-xs font-semibold">Loading trash bucket...</p>
              </div>
            </td>
          </tr>
        ) : trashBatches.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-16 text-center">
              <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700 text-sm">Trash bucket is empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Batches deleted from the main view will appear here for 30 days before permanent deletion.
              </p>
            </td>
          </tr>
        ) : (
          trashBatches.map((batch) => {
            const days = batch.days_remaining ?? 30;
            return (
              <tr key={batch.id} className="hover:bg-rose-50/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{batch.name}</div>
                  {batch.description && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">
                      {batch.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-600 font-medium">
                    {batch.source_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-center font-bold text-slate-700">
                  {batch.school_count}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  {batch.deleted_at
                    ? new Date(batch.deleted_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recently'}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      days <= 5
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{days === 0 ? 'Purging today' : `${days} days left`}</span>
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestore(batch)}
                      disabled={isSubmitting}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                      title="Restore batch back to active state"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePermanent(batch)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 bg-white text-rose-700 text-xs font-medium rounded-md border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Delete permanently from database"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span className="hidden sm:inline">Delete Forever</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
};
