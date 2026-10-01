import React from 'react';
import { Layers, Plus, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import type { BatchSummaryItem } from '../../types';

interface ActiveBatchesTableProps {
  batches: BatchSummaryItem[];
  isLoading: boolean;
  onOpen: (id: string) => void;
  onEdit: (batch: BatchSummaryItem) => void;
  onDelete: (batch: BatchSummaryItem) => void;
  onCreateClick: () => void;
}

export const ActiveBatchesTable: React.FC<ActiveBatchesTableProps> = ({
  batches,
  isLoading,
  onOpen,
  onEdit,
  onDelete,
  onCreateClick,
}) => {
  return (
    <table className="w-full text-left text-sm whitespace-nowrap">
      <thead className="bg-[#F8FAFC] border-b border-[#EEF2F7] text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
        <tr>
          <th className="px-6 py-3.5">Name</th>
          <th className="px-6 py-3.5">Source</th>
          <th className="px-6 py-3.5 text-center">Schools</th>
          <th className="px-6 py-3.5">Status</th>
          <th className="px-6 py-3.5">Created</th>
          <th className="px-6 py-3.5 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#EEF2F7] bg-white">
        {isLoading ? (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xs font-semibold">Loading batches...</p>
              </div>
            </td>
          </tr>
        ) : batches.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-16 text-center">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700 text-sm">No batches found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create your first operational batch to group schools and start automated agent pipelines.
              </p>
              <button
                type="button"
                onClick={onCreateClick}
                className="mt-4 px-4 py-2 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create batch</span>
              </button>
            </td>
          </tr>
        ) : (
          batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors group">
              <td className="px-6 py-4">
                <div
                  onClick={() => onOpen(batch.id)}
                  className="font-bold text-[#0A1F3C] group-hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {batch.name}
                </div>
                {batch.description && (
                  <div className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">
                    {batch.description}
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <span className="text-xs text-slate-600 font-medium">
                  {batch.source_type.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-center font-bold text-slate-800">
                {batch.school_count}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`chip ${
                    batch.status === 'ready'
                      ? 'chip-ready'
                      : batch.status === 'processing'
                      ? 'chip-processing'
                      : batch.status === 'completed'
                      ? 'chip-verified'
                      : 'chip-neutral'
                  }`}
                >
                  {batch.status}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">
                {new Date(batch.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(batch.id)}
                    className="px-3 py-1 bg-[#0A1F3C] text-white text-xs font-semibold rounded-md hover:bg-[#12305C] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    title="Open Batch Details"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onEdit(batch)}
                    className="px-2.5 py-1 bg-white text-slate-700 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    title="Edit Batch & Manage Schools"
                  >
                    <Pencil className="w-3 h-3 text-slate-500" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(batch)}
                    className="px-2.5 py-1 bg-white text-rose-600 text-xs font-medium rounded-md border border-rose-200 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    title="Delete Batch (Moves to 30-Day Trash)"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};
