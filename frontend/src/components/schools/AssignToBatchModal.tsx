import React, { useEffect, useState } from 'react';
import type { BatchSummaryItem, School } from '../../types';
import { api } from '../../services/api';
import { X, Layers, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface AssignToBatchModalProps {
  selectedSchools: School[];
  onClose: () => void;
  onAssigned: () => void;
  onFeedback?: (msg: string) => void;
}

export const AssignToBatchModal: React.FC<AssignToBatchModalProps> = ({
  selectedSchools,
  onClose,
  onAssigned,
  onFeedback,
}) => {
  const [batches, setBatches] = useState<BatchSummaryItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDescription, setNewBatchDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .getBatches({ status: 'All' })
      .then((data) => {
        if (!isMounted) return;
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatchId(data[0].id);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMessage('Failed to load existing batches.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingBatches(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSchools.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let targetBatchId = selectedBatchId;

      // Quick create batch if requested
      if (isCreatingNew) {
        if (!newBatchName.trim()) {
          setErrorMessage('Please provide a name for the new batch.');
          setIsSubmitting(false);
          return;
        }

        const confirmResp = await api.confirmBatchUpload({
          name: newBatchName.trim(),
          source_type: 'Manual Assignment',
          description: newBatchDescription.trim() || `Created from ${selectedSchools.length} assigned school(s)`,
          rows: [],
        });
        targetBatchId = confirmResp.batch_id;
      }

      if (!targetBatchId) {
        setErrorMessage('Please select a target batch.');
        setIsSubmitting(false);
        return;
      }

      // Add schools to batch
      let addedCount = 0;
      for (const school of selectedSchools) {
        try {
          await api.addSchoolToBatch(targetBatchId, {
            school_id: school.id,
            name: school.name,
            website: school.website || undefined,
            address: school.address || undefined,
            district: school.district || undefined,
          });
          addedCount++;
        } catch {
          // School might already be in batch, continue
        }
      }

      const targetBatch = batches.find((b) => b.id === targetBatchId);
      const batchName = targetBatch ? targetBatch.name : newBatchName;
      onFeedback?.(
        `Assigned ${addedCount} school(s) to batch '${batchName}'.`
      );
      onAssigned();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign schools to batch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Assign to Batch</h2>
              <p className="text-xs text-slate-500">
                Adding {selectedSchools.length} selected school(s) to a processing batch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAssign} className="p-6 space-y-4 text-xs overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                !isCreatingNew
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Existing Batch
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                isCreatingNew
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Create New Batch
            </button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Select Target Batch</label>
              {isLoadingBatches ? (
                <div className="flex items-center gap-2 text-slate-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading batches...</span>
                </div>
              ) : batches.length === 0 ? (
                <div className="text-slate-400 italic py-2">
                  No active batches available. Switch to &quot;Create New Batch&quot;.
                </div>
              ) : (
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.school_count} schools) — [{b.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">New Batch Name *</label>
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g. Austin Charter Schools Q1"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Description (Optional)</label>
                <input
                  type="text"
                  value={newBatchDescription}
                  onChange={(e) => setNewBatchDescription(e.target.value)}
                  placeholder="e.g. Selected from master directory for open seats crawl"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Selected Schools Preview */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Selected Schools ({selectedSchools.length})</span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              {selectedSchools.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-[11px] py-0.5 text-slate-700 truncate"
                >
                  <span className="font-medium truncate mr-2">{s.name}</span>
                  <span className="text-slate-400 flex-shrink-0">{s.city || 'TX'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isCreatingNew && !selectedBatchId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assign {selectedSchools.length} School(s)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
