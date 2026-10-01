import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useReviewStore } from '../stores/reviewStore';
import { useAppStore } from '../stores/appStore';
import { SchoolEvidenceDrawer } from '../components/review/SchoolEvidenceDrawer';
import type { VerificationSchoolItem, UserRole } from '../types';
import {
  RotateCw,
  Search,
  ChevronDown,
  ExternalLink,
  Check,
  X,
  FileCheck2,
  AlertCircle,
  Eye,
} from 'lucide-react';

const PRODUCT_OPTIONS = [
  { key: 'info', label: 'School Profile & Metadata' },
];

export interface ReviewQueueViewProps {
  currentRole?: UserRole;
  onActionFeedback?: (msg: string) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = () => {
  const {
    schools,
    isLoading,
    isProcessing,
    selectedBatchId,
    selectedProductKey,
    searchQuery,
    batches,
    isLoadingBatches,
    selectedSchoolIds,
    selectedSchool,
    isDrawerOpen,
  } = useReviewStore(
    useShallow((s) => ({
      schools: s.schools,
      isLoading: s.isLoading,
      isProcessing: s.isProcessing,
      selectedBatchId: s.selectedBatchId,
      selectedProductKey: s.selectedProductKey,
      searchQuery: s.searchQuery,
      batches: s.batches,
      isLoadingBatches: s.isLoadingBatches,
      selectedSchoolIds: s.selectedSchoolIds,
      selectedSchool: s.selectedSchool,
      isDrawerOpen: s.isDrawerOpen,
    }))
  );

  const fetchBatches = useReviewStore((s) => s.fetchBatches);
  const fetchReviewSchools = useReviewStore((s) => s.fetchReviewSchools);
  const setSelectedBatchId = useReviewStore((s) => s.setSelectedBatchId);
  const setSelectedProductKey = useReviewStore((s) => s.setSelectedProductKey);
  const setSearchQuery = useReviewStore((s) => s.setSearchQuery);
  const toggleSelectSchool = useReviewStore((s) => s.toggleSelectSchool);
  const selectAllSchools = useReviewStore((s) => s.selectAllSchools);
  const clearSelection = useReviewStore((s) => s.clearSelection);
  const openDrawer = useReviewStore((s) => s.openDrawer);
  const closeDrawer = useReviewStore((s) => s.closeDrawer);
  const executeAction = useReviewStore((s) => s.executeAction);
  const showToast = useAppStore((s) => s.showToast);

  const [confirmBatchAction, setConfirmBatchAction] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    fetchBatches();
    fetchReviewSchools('verification');
  }, [fetchBatches, fetchReviewSchools]);

  // Client-side search filtering
  const filteredSchools = useMemo(() => {
    if (!searchQuery.trim()) return schools;
    const q = searchQuery.toLowerCase();
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.district && s.district.toLowerCase().includes(q)) ||
        (s.website && s.website.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }, [schools, searchQuery]);

  const allVisibleSelected =
    filteredSchools.length > 0 &&
    filteredSchools.every((s) => selectedSchoolIds.includes(s.id));

  const handleSelectAllToggle = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      selectAllSchools(filteredSchools.map((s) => s.id));
    }
  };

  const handleApproveSingle = async (school: VerificationSchoolItem) => {
    try {
      const msg = await executeAction({
        action: 'approve',
        scope: 'single',
        schoolIds: [school.id],
        queueType: 'verification',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to approve school.', 'error');
    }
  };

  const handleRejectSingle = async (school: VerificationSchoolItem) => {
    try {
      const msg = await executeAction({
        action: 'reject',
        scope: 'single',
        schoolIds: [school.id],
        queueType: 'verification',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to reject school.', 'error');
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedSchoolIds.length === 0) return;
    try {
      const msg = await executeAction({
        action,
        scope: 'group',
        schoolIds: selectedSchoolIds,
        queueType: 'verification',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} selected schools.`, 'error');
    }
  };

  const handleBatchActionConfirm = async () => {
    if (!confirmBatchAction) return;
    try {
      const msg = await executeAction({
        action: confirmBatchAction,
        scope: 'batch',
        batchId: selectedBatchId !== 'all' ? selectedBatchId : undefined,
        queueType: 'verification',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || `Failed to execute batch ${confirmBatchAction}.`, 'error');
    } finally {
      setConfirmBatchAction(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Top Banner / Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-600" />
              <span>Verification Queue</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and verify crawled attributes, inspect source evidence in the side slide, and approve or reject at school, selection, or batch level.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch-level action triggers */}
            <button
              type="button"
              disabled={isProcessing || filteredSchools.length === 0}
              onClick={() => setConfirmBatchAction('approve')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve Batch</span>
            </button>

            <button
              type="button"
              disabled={isProcessing || filteredSchools.length === 0}
              onClick={() => setConfirmBatchAction('reject')}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject Batch</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReviewSchools('verification')}
              disabled={isLoading || isProcessing}
              className="px-3 py-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer transition-colors text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs"
              title="Refresh Queue"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 border-t border-slate-100">
          {/* Batch Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Batch:</span>
            <div className="relative min-w-[200px]">
              <select
                aria-label="Filter by Batch"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value, 'verification')}
                disabled={isLoadingBatches}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-1.5 pr-8 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="all">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.school_count} schools)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Product Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Product:</span>
            <div className="relative min-w-[200px]">
              <select
                aria-label="Filter by Product"
                value={selectedProductKey}
                onChange={(e) => setSelectedProductKey(e.target.value, 'verification')}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-1.5 pr-8 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                {PRODUCT_OPTIONS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search schools, district, phone, website..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedSchoolIds.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-blue-900 font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>{selectedSchoolIds.length} school(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleBulkAction('approve')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>Approve Selected ({selectedSchoolIds.length})</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleBulkAction('reject')}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reject Selected ({selectedSchoolIds.length})</span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-blue-100/60 rounded font-medium cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleSelectAllToggle}
                    aria-label="Select all visible schools"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 font-semibold">School & District</th>
                <th className="py-3 px-4 font-semibold">Batch</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">DQA Score</th>
                <th className="py-3 px-4 font-semibold">Confidence</th>
                <th className="py-3 px-4 font-semibold">Evidence Citations</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Loading verification queue...</span>
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-medium text-slate-600 block">Verification Queue is Clear</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      All schools in this batch have been verified or routed. Check "Approved Schools" or "Re-crawl Queue".
                    </span>
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const isSelected = selectedSchoolIds.includes(school.id);
                  return (
                    <tr
                      key={school.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectSchool(school.id)}
                          aria-label={`Select ${school.name}`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{school.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{school.district || 'Independent District'}</span>
                          {school.website && (
                            <>
                              <span>•</span>
                              <a
                                href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline flex items-center gap-0.5 truncate max-w-[150px]"
                              >
                                <span className="truncate">{school.website}</span>
                                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium text-[11px]">
                          {school.batch_name}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-semibold text-[10px] uppercase tracking-wide">
                          {school.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {school.dqa_score !== null && school.dqa_score !== undefined ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded text-[11px]">
                            {school.dqa_score}/100
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pending</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {school.confidence_score !== null && school.confidence_score !== undefined ? (
                          <span className="font-semibold text-slate-700">
                            {school.confidence_score}%
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-600">
                          {school.evidence_count} citations
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          <button
                            type="button"
                            onClick={() => openDrawer(school)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md cursor-pointer transition-colors shadow-2xs"
                            title="View Evidences & Details in Side Slide"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRejectSingle(school)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer transition-colors shadow-2xs"
                            title="Reject & Route to Re-crawl"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApproveSingle(school)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md cursor-pointer transition-colors shadow-2xs"
                            title="Approve & Route to Approved Schools"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Slide Drawer for Evidences and Extracted Attributes */}
      <SchoolEvidenceDrawer
        school={selectedSchool}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        queueType="verification"
        isProcessing={isProcessing}
        onApprove={handleApproveSingle}
        onReject={handleRejectSingle}
      />

      {/* Confirmation Modal for Batch Approve / Reject */}
      {confirmBatchAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg flex-shrink-0 ${
                  confirmBatchAction === 'approve'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {confirmBatchAction === 'approve' ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {confirmBatchAction === 'approve'
                    ? 'Approve Entire Batch?'
                    : 'Reject Entire Batch?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmBatchAction === 'approve'
                    ? 'This will approve all pending schools in this batch, mark their extracted attributes as verified, and move them to Approved Schools.'
                    : 'This will reject all schools in this batch and move them to the Re-crawl Queue for agent re-processing.'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmBatchAction(null)}
                disabled={isProcessing}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchActionConfirm}
                disabled={isProcessing}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shadow-2xs ${
                  confirmBatchAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
