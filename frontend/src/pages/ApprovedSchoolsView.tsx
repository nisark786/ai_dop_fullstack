import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useReviewStore } from '../stores/reviewStore';
import { useAppStore } from '../stores/appStore';
import { SchoolEvidenceDrawer } from '../components/review/SchoolEvidenceDrawer';
import type { VerificationSchoolItem } from '../types';
import {
  RotateCw,
  Search,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Undo2,
  Eye,
  Rocket,
} from 'lucide-react';

const PRODUCT_OPTIONS = [
  { key: 'info', label: 'School Profile & Metadata' },
];

export const ApprovedSchoolsView: React.FC = () => {
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

  const [confirmUndoBatch, setConfirmUndoBatch] = useState(false);
  const [confirmPublishAction, setConfirmPublishAction] = useState<{
    scope: 'single' | 'group' | 'batch';
    school?: VerificationSchoolItem;
  } | null>(null);

  useEffect(() => {
    fetchBatches();
    fetchReviewSchools('approved');
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

  const handleUndoSingle = async (school: VerificationSchoolItem) => {
    try {
      const msg = await executeAction({
        action: 'undo',
        scope: 'single',
        schoolIds: [school.id],
        queueType: 'approved',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to undo school approval.', 'error');
    }
  };

  const handleBulkUndo = async () => {
    if (selectedSchoolIds.length === 0) return;
    try {
      const msg = await executeAction({
        action: 'undo',
        scope: 'group',
        schoolIds: selectedSchoolIds,
        queueType: 'approved',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to undo selected schools.', 'error');
    }
  };

  const handleBatchUndoConfirm = async () => {
    try {
      const msg = await executeAction({
        action: 'undo',
        scope: 'batch',
        batchId: selectedBatchId !== 'all' ? selectedBatchId : undefined,
        queueType: 'approved',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to undo batch approvals.', 'error');
    } finally {
      setConfirmUndoBatch(false);
    }
  };

  const handlePublishSingle = (school: VerificationSchoolItem) => {
    setConfirmPublishAction({ scope: 'single', school });
  };

  const handlePublishSelected = () => {
    if (selectedSchoolIds.length === 0) return;
    setConfirmPublishAction({ scope: 'group' });
  };

  const handlePublishBatch = () => {
    setConfirmPublishAction({ scope: 'batch' });
  };

  const handleConfirmPublish = async () => {
    if (!confirmPublishAction) return;
    try {
      const msg = await executeAction({
        action: 'publish',
        scope: confirmPublishAction.scope,
        schoolIds:
          confirmPublishAction.scope === 'single' && confirmPublishAction.school
            ? [confirmPublishAction.school.id]
            : confirmPublishAction.scope === 'group'
            ? selectedSchoolIds
            : [],
        batchId:
          confirmPublishAction.scope === 'batch' && selectedBatchId !== 'all'
            ? selectedBatchId
            : undefined,
        queueType: 'approved',
      });
      showToast(msg, 'success');
      clearSelection();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish school(s) to production.', 'error');
    } finally {
      setConfirmPublishAction(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Top Banner / Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Approved Schools</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified records with crawled attributes, contact data, and DQA audits. Use Undo to return any record to the Verification Queue.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isProcessing || filteredSchools.length === 0}
              onClick={handlePublishBatch}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
              title="Promote all approved schools in this batch to master production Schools table"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Publish Approved Batch</span>
            </button>

            <button
              type="button"
              disabled={isProcessing || filteredSchools.length === 0}
              onClick={() => setConfirmUndoBatch(true)}
              className="px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo Batch Approvals</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReviewSchools('approved')}
              disabled={isLoading || isProcessing}
              className="px-3 py-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer transition-colors text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs"
              title="Refresh Approved List"
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
                onChange={(e) => setSelectedBatchId(e.target.value, 'approved')}
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
                onChange={(e) => setSelectedProductKey(e.target.value, 'approved')}
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
              placeholder="Search approved schools, district, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedSchoolIds.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            <span>{selectedSchoolIds.length} approved school(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handlePublishSelected}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              <Rocket className="w-3 h-3" />
              <span>Publish Selected ({selectedSchoolIds.length})</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBulkUndo}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              <Undo2 className="w-3 h-3" />
              <span>Return to Verification ({selectedSchoolIds.length})</span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-amber-100/60 rounded font-medium cursor-pointer"
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
                <th className="py-3 px-4 font-semibold">School & Contact</th>
                <th className="py-3 px-4 font-semibold">Batch</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">DQA Score</th>
                <th className="py-3 px-4 font-semibold">Phone & Address</th>
                <th className="py-3 px-4 font-semibold">Citations</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Loading approved schools...</span>
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-medium text-slate-600 block">No Approved Schools Yet</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Approve schools from the Verification Queue to view their verified golden records here.
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
                        isSelected ? 'bg-amber-50/40' : ''
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
                        {school.is_published || school.status === 'published' ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1 w-fit">
                              <Rocket className="w-3 h-3 text-blue-600" />
                              Published
                            </span>
                            {school.sandbox_sync?.status === 'synced' && (
                              <span
                                className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium"
                                title={school.sandbox_sync.sandbox_id ? `Sandbox UUID: ${school.sandbox_sync.sandbox_id}` : 'Synced to RDS Sandbox'}
                              >
                                ● Sandbox Synced
                              </span>
                            )}
                            {school.sandbox_sync?.status === 'failed' && (
                              <span
                                className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-medium"
                                title={school.sandbox_sync.error || 'Failed to sync to Sandbox'}
                              >
                                ● Sandbox Failed
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-semibold text-[10px] uppercase tracking-wide">
                            Verified
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {school.dqa_score !== null && school.dqa_score !== undefined ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded text-[11px]">
                            {school.dqa_score}/100
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium truncate max-w-[180px]">
                          {school.phone || 'No phone'}
                        </div>
                        <div className="text-slate-400 text-[11px] truncate max-w-[180px]">
                          {school.address || 'No address'}
                        </div>
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
                            title="Inspect Crawled Details & Citations"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                          {school.is_published || school.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
                              <Rocket className="w-3.5 h-3.5" />
                              <span>Published</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handlePublishSingle(school)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md cursor-pointer transition-colors shadow-2xs"
                              title="Promote to Master Production Schools"
                            >
                              <Rocket className="w-3.5 h-3.5" />
                              <span>Publish</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUndoSingle(school)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md cursor-pointer transition-colors shadow-2xs"
                            title="Return to Verification Queue (Undo)"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Undo</span>
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

      {/* Side Slide Drawer for Full Evidence & Record Inspection */}
      <SchoolEvidenceDrawer
        school={selectedSchool}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        queueType="approved"
        isProcessing={isProcessing}
        onUndo={handleUndoSingle}
        onPublish={handlePublishSingle}
      />

      {/* Confirmation Modal for Batch Undo */}
      {confirmUndoBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 flex-shrink-0">
                <Undo2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Undo All Batch Approvals?</h3>
                <p className="text-xs text-slate-500">
                  This will revert all approved schools in this batch back to "Needs Verification" and return them to the Verification Queue.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmUndoBatch(false)}
                disabled={isProcessing}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchUndoConfirm}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer shadow-2xs"
              >
                {isProcessing ? 'Reverting...' : 'Confirm Undo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Publish Action */}
      {confirmPublishAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 flex-shrink-0">
                <Rocket className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {confirmPublishAction.scope === 'single'
                    ? `Publish ${confirmPublishAction.school?.name || 'School'} to Production?`
                    : confirmPublishAction.scope === 'group'
                    ? `Publish ${selectedSchoolIds.length} Selected Schools to Production?`
                    : 'Publish All Approved Batch Schools to Production?'}
                </h3>
                <p className="text-xs text-slate-500">
                  This will promote the verified record(s) into the master <strong className="font-semibold text-slate-700">Schools</strong> catalog and update their status to Published. They will be visible under School Management.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmPublishAction(null)}
                disabled={isProcessing}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Confirm & Publish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
