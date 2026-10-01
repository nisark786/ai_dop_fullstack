import React, { useEffect, useState } from 'react';
import { Trash2, Clock, Search, RefreshCw, Layers, School as SchoolIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { BatchSummaryItem, SchoolTrashItem } from '../types';
import { useTrashStore, type TrashTab } from '../stores/trashStore';
import { useAppStore } from '../stores/appStore';
import { TrashBatchesTable, DeleteBatchModal } from '../components/batches';
import { TrashSchoolsTable } from '../components/schools/TrashSchoolsTable';

export const TrashBucketView: React.FC = () => {
  const { trashBatches, trashSchools, activeTab, isLoading, isPurging } = useTrashStore(
    useShallow((s) => ({
      trashBatches: s.trashBatches,
      trashSchools: s.trashSchools,
      activeTab: s.activeTab,
      isLoading: s.isLoading,
      isPurging: s.isPurging,
    }))
  );

  const setActiveTab = useTrashStore((s) => s.setActiveTab);
  const fetchTrashBatches = useTrashStore((s) => s.fetchTrashBatches);
  const fetchTrashSchools = useTrashStore((s) => s.fetchTrashSchools);
  const restoreBatch = useTrashStore((s) => s.restoreBatch);
  const permanentDeleteBatch = useTrashStore((s) => s.permanentDeleteBatch);
  const restoreSchool = useTrashStore((s) => s.restoreSchool);
  const permanentDeleteSchool = useTrashStore((s) => s.permanentDeleteSchool);
  const purgeExpired = useTrashStore((s) => s.purgeExpired);

  const showToast = useAppStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [permanentDeletingBatch, setPermanentDeletingBatch] = useState<BatchSummaryItem | null>(null);
  const [permanentDeletingSchool, setPermanentDeletingSchool] = useState<SchoolTrashItem | null>(null);
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial load: fetch both batches and schools for badges count
  useEffect(() => {
    fetchTrashBatches();
    fetchTrashSchools();
  }, [fetchTrashBatches, fetchTrashSchools]);

  // Fetch when tab or search query changes
  useEffect(() => {
    const q = searchQuery.trim() || undefined;
    if (activeTab === 'batches') {
      fetchTrashBatches(q);
    } else {
      fetchTrashSchools(q);
    }
  }, [activeTab, searchQuery, fetchTrashBatches, fetchTrashSchools]);

  const handleTabChange = (tab: TrashTab) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  const handleRefresh = () => {
    const q = searchQuery.trim() || undefined;
    if (activeTab === 'batches') {
      fetchTrashBatches(q);
    } else {
      fetchTrashSchools(q);
    }
  };

  // --- Batch Handlers ---
  const handleRestoreBatch = async (batch: BatchSummaryItem) => {
    setIsSubmitting(true);
    const success = await restoreBatch(batch.id);
    setIsSubmitting(false);

    if (success) {
      showToast(`Batch "${batch.name}" successfully restored.`, 'success');
    } else {
      showToast('Failed to restore batch.', 'error');
    }
  };

  const handleConfirmPermanentDeleteBatch = async () => {
    if (!permanentDeletingBatch) return;

    setIsSubmitting(true);
    const success = await permanentDeleteBatch(permanentDeletingBatch.id);
    setIsSubmitting(false);

    if (success) {
      showToast(`Batch "${permanentDeletingBatch.name}" permanently deleted.`, 'success');
      setPermanentDeletingBatch(null);
    } else {
      showToast('Failed to permanently delete batch.', 'error');
    }
  };

  // --- School Handlers ---
  const handleRestoreSchool = async (school: SchoolTrashItem) => {
    setIsSubmitting(true);
    const success = await restoreSchool(school.id);
    setIsSubmitting(false);

    if (success) {
      showToast(`School "${school.name}" successfully restored to master library.`, 'success');
    } else {
      showToast('Failed to restore school.', 'error');
    }
  };

  const handleConfirmPermanentDeleteSchool = async () => {
    if (!permanentDeletingSchool) return;

    setIsSubmitting(true);
    const success = await permanentDeleteSchool(permanentDeletingSchool.id);
    setIsSubmitting(false);

    if (success) {
      showToast(`School "${permanentDeletingSchool.name}" permanently deleted.`, 'success');
      setPermanentDeletingSchool(null);
    } else {
      showToast('Failed to permanently delete school.', 'error');
    }
  };

  // --- Purge Handler ---
  const handleConfirmPurge = async () => {
    setIsSubmitting(true);
    const res = await purgeExpired(30);
    setIsSubmitting(false);

    if (res) {
      showToast(res.message || 'Trash cleanup completed.', 'success');
      setIsPurgeConfirmOpen(false);
    } else {
      showToast('Failed to purge expired trash.', 'error');
    }
  };

  const currentTabCount = activeTab === 'batches' ? trashBatches.length : trashSchools.length;
  const currentTabLabel = activeTab === 'batches' ? 'batches' : 'schools';

  const expiringSoonCount =
    activeTab === 'batches'
      ? trashBatches.filter((b) => (b.days_remaining ?? 30) <= 5).length
      : trashSchools.filter((s) => (s.days_remaining ?? 30) <= 5).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0A1F3C] flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <span>Trash Bucket</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quarantined operational entities. Items are safely retained for 30 days before permanent deletion.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPurgeConfirmOpen(true)}
            disabled={currentTabCount === 0 || isPurging}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 shadow-2xs ${
              currentTabCount === 0 || isPurging
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 cursor-pointer'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Purge expired {currentTabLabel}</span>
          </button>
        </div>
      </div>

      {/* Retention Policy Warning Banner */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900">30-Day Safe Retention Policy Active</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Soft-deleted batches and master schools remain restorable for 30 days from deletion. Permanent deletion wipes records and relational mappings entirely from the database.
            </p>
          </div>
        </div>
        {expiringSoonCount > 0 && (
          <span className="shrink-0 px-2.5 py-1 bg-amber-200/70 text-amber-900 text-[11px] font-bold rounded-md">
            {expiringSoonCount} {expiringSoonCount === 1 ? 'item' : 'items'} expiring soon
          </span>
        )}
      </div>

      {/* Entity Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('batches')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'batches'
              ? 'bg-[#0A1F3C] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Batches</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'batches'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {trashBatches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('schools')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'schools'
              ? 'bg-[#0A1F3C] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <SchoolIcon className="w-3.5 h-3.5" />
          <span>Schools</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'schools'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {trashSchools.length}
          </span>
        </button>
      </div>

      {/* Main Trash Table Card */}
      <div className="card">
        {/* Card Header & Controls */}
        <div className="ch flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#0A1F3C]">
              Quarantined {activeTab === 'batches' ? 'Batches' : 'Schools'}
            </span>
            <span className="text-xs text-slate-400 font-normal">
              ({currentTabCount} {currentTabCount === 1 ? (activeTab === 'batches' ? 'batch' : 'school') : (activeTab === 'batches' ? 'batches' : 'schools')} in trash)
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={`Search ${activeTab} by name...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-x-auto">
          {activeTab === 'batches' ? (
            <TrashBatchesTable
              trashBatches={trashBatches}
              isLoading={isLoading}
              isSubmitting={isSubmitting}
              onRestore={handleRestoreBatch}
              onDeletePermanent={(b) => setPermanentDeletingBatch(b)}
            />
          ) : (
            <TrashSchoolsTable
              trashSchools={trashSchools}
              isLoading={isLoading}
              isSubmitting={isSubmitting}
              onRestore={handleRestoreSchool}
              onDeletePermanent={(s) => setPermanentDeletingSchool(s)}
            />
          )}
        </div>
      </div>

      {/* Permanent Delete Batch Modal */}
      <DeleteBatchModal
        deletingBatch={null}
        permanentDeletingBatch={permanentDeletingBatch}
        isSubmitting={isSubmitting}
        onClose={() => setPermanentDeletingBatch(null)}
        onConfirmSoftDelete={() => {}}
        onConfirmPermanentDelete={handleConfirmPermanentDeleteBatch}
      />

      {/* Permanent Delete School Modal */}
      {permanentDeletingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-rose-950 text-base">Permanently Delete School?</h3>
                  <p className="text-xs text-slate-600">
                    This action is <strong className="text-rose-600">irreversible</strong>. School{' '}
                    <span className="font-semibold text-slate-900">"{permanentDeletingSchool.name}"</span> and all its crawler extractions and batch associations will be permanently destroyed.
                  </p>
                </div>
              </div>

              <div className="flex justify-end items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setPermanentDeletingSchool(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPermanentDeleteSchool}
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
      )}

      {/* Purge Expired Confirmation Modal */}
      {isPurgeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Purge Expired {activeTab === 'batches' ? 'Batches' : 'Schools'}?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will identify and permanently eliminate all {activeTab} quarantined in the Trash Bucket for more than 30 days. This operation cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPurgeConfirmOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashBucketView;
