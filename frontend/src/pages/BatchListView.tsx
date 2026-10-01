import React, { useEffect, useState } from 'react';
import { Layers, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { BatchSummaryItem } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { useBatchStore } from '../stores/batchStore';
import { useAppStore } from '../stores/appStore';
import {
  BatchKpiCards,
  ActiveBatchesTable,
  DeleteBatchModal,
  EditBatchModal,
} from '../components/batches';

export const BatchListView: React.FC = () => {
  const { batches, isLoading } = useBatchStore(
    useShallow((s) => ({
      batches: s.batches,
      isLoading: s.isLoading,
    }))
  );
  const fetchBatches = useBatchStore((s) => s.fetchBatches);
  const softDeleteBatch = useBatchStore((s) => s.softDeleteBatch);

  const showToast = useAppStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState<'All' | 'Ready' | 'Processing' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & action states
  const [editingBatch, setEditingBatch] = useState<BatchSummaryItem | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<BatchSummaryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches({
      status: activeTab === 'All' ? undefined : activeTab.toLowerCase(),
      search: searchQuery.trim() || undefined,
    });
  }, [activeTab, searchQuery, fetchBatches]);

  const handleConfirmSoftDelete = async () => {
    if (!deletingBatch) return;

    setIsSubmitting(true);
    const success = await softDeleteBatch(deletingBatch.id);
    setIsSubmitting(false);

    if (success) {
      showToast(`Batch "${deletingBatch.name}" moved to Trash Bucket. Retained for 30 days.`, 'success');
      setDeletingBatch(null);
    } else {
      showToast('Failed to move batch to Trash.', 'error');
    }
  };

  const tabs: Array<'All' | 'Ready' | 'Processing' | 'Completed'> = ['All', 'Ready', 'Processing', 'Completed'];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0A1F3C] flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Batch Intake & Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Group schools into operational batches for agent execution and tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/batches/create')}
          className="px-4 py-2 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create batch</span>
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <BatchKpiCards batches={batches} />

      {/* Main Card */}
      <div className="card">
        {/* Card Header & Controls */}
        <div className="ch flex-col md:flex-row items-stretch md:items-center gap-4 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#0A1F3C]">All batches</span>
            <span className="text-xs text-slate-400 font-normal">
              ({batches.length} {batches.length === 1 ? 'batch' : 'batches'})
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Filter Tabs */}
            <div className="inline-flex bg-[#EEF2F8] p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-white text-[#0A1F3C] shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-[#0A1F3C]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search batches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Content Table: Active Batches */}
        <div className="overflow-x-auto">
          <ActiveBatchesTable
            batches={batches}
            isLoading={isLoading}
            onOpen={(batchId) => navigate(`/batches/${batchId}`)}
            onEdit={(b) => setEditingBatch(b)}
            onDelete={(b) => setDeletingBatch(b)}
            onCreateClick={() => navigate('/batches/create')}
          />
        </div>
      </div>

      {/* Edit Batch Modal */}
      <EditBatchModal
        batch={editingBatch}
        onClose={() => setEditingBatch(null)}
        onBatchUpdated={() => fetchBatches()}
        showNotification={(msg, type) => showToast(msg, type || 'success')}
      />

      {/* Soft Delete Modal */}
      <DeleteBatchModal
        deletingBatch={deletingBatch}
        permanentDeletingBatch={null}
        isSubmitting={isSubmitting}
        onClose={() => setDeletingBatch(null)}
        onConfirmSoftDelete={handleConfirmSoftDelete}
        onConfirmPermanentDelete={() => {}}
      />
    </div>
  );
};

export default BatchListView;
