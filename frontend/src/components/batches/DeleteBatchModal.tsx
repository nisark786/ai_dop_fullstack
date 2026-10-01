import React from 'react';
import { AlertTriangle, Clock, Trash2 } from 'lucide-react';
import type { BatchSummaryItem } from '../../types';

interface DeleteBatchModalProps {
  deletingBatch: BatchSummaryItem | null;
  permanentDeletingBatch: BatchSummaryItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmSoftDelete: () => void;
  onConfirmPermanentDelete: () => void;
}

export const DeleteBatchModal: React.FC<DeleteBatchModalProps> = ({
  deletingBatch,
  permanentDeletingBatch,
  isSubmitting,
  onClose,
  onConfirmSoftDelete,
  onConfirmPermanentDelete,
}) => {
  if (!deletingBatch && !permanentDeletingBatch) return null;

  if (deletingBatch) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-rose-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-base">Move Batch to Trash?</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">"{deletingBatch.name}"</span>?
                </p>
              </div>
            </div>

            {/* 30-Day Retention Notice */}
            <div className="mt-4 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                <Clock className="w-3.5 h-3.5" />
                <span>30-Day Trash Bucket Retention</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                This batch will not be permanently deleted immediately. It will be moved to the Trash Bucket and retained for <strong>30 days</strong>. You can restore it at any time during this period.
              </p>
            </div>

            <div className="flex justify-end items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmSoftDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Moving to Trash...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Move to Trash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-rose-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-rose-950 text-base">Permanently Delete Batch?</h3>
              <p className="text-xs text-slate-600">
                This action is <strong className="text-rose-600">irreversible</strong>. Batch{' '}
                <span className="font-semibold text-slate-900">"{permanentDeletingBatch?.name}"</span> and its operational associations will be permanently removed from the database.
              </p>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmPermanentDelete}
              disabled={isSubmitting}
              className="px-4 py-2 bg-rose-700 text-white text-xs font-bold rounded-lg hover:bg-rose-800 transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deleting forever...</span>
                </>
              ) : (
                <span>Delete Forever</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
