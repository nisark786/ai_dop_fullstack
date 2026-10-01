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
  RefreshCw,
  Undo2,
  Eye,
  Play,
} from 'lucide-react';

const PRODUCT_OPTIONS = [
  { key: 'info', label: 'School Profile & Metadata' },
];

export const RecrawlQueueView: React.FC = () => {
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
  const recrawlSchool = useReviewStore((s) => s.recrawlSchool);
  const recrawlBatch = useReviewStore((s) => s.recrawlBatch);
  const showToast = useAppStore((s) => s.showToast);

  const [confirmRecrawlBatch, setConfirmRecrawlBatch] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetchReviewSchools('recrawl');
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
        queueType: 'recrawl',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to undo rejection.', 'error');
    }
  };

  const handleBulkUndo = async () => {
    if (selectedSchoolIds.length === 0) return;
    try {
      const msg = await executeAction({
        action: 'undo',
        scope: 'group',
        schoolIds: selectedSchoolIds,
        queueType: 'recrawl',
      });
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to undo selected rejections.', 'error');
    }
  };

  const handleRecrawlSingle = async (school: VerificationSchoolItem) => {
    try {
      const msg = await recrawlSchool(school.id, school.batch_id, 'recrawl');
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch re-crawl.', 'error');
    }
  };

  const handleRecrawlBatchConfirm = async () => {
    if (filteredSchools.length === 0) return;
    try {
      const targetBatchId =
        selectedBatchId !== 'all' ? selectedBatchId : filteredSchools[0].batch_id;
      const schoolIds = selectedSchoolIds.length > 0 ? selectedSchoolIds : filteredSchools.map((s) => s.id);
      const msg = await recrawlBatch(targetBatchId, schoolIds, 'recrawl');
      showToast(msg, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch batch re-crawl.', 'error');
    } finally {
      setConfirmRecrawlBatch(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Top Banner / Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              <span>Re-crawl Queue</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Rejected schools queued for agent re-crawling. Run crawler re-scrapes at school or batch level, or Undo accidental rejections.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isProcessing || filteredSchools.length === 0}
              onClick={() => setConfirmRecrawlBatch(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Re-crawl Rejected in Batch</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReviewSchools('recrawl')}
              disabled={isLoading || isProcessing}
              className="px-3 py-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer transition-colors text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs"
              title="Refresh Re-crawl Queue"
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
                onChange={(e) => setSelectedBatchId(e.target.value, 'recrawl')}
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
                onChange={(e) => setSelectedProductKey(e.target.value, 'recrawl')}
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
              placeholder="Search rejected schools, district, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedSchoolIds.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-indigo-900 font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>{selectedSchoolIds.length} rejected school(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleRecrawlBatchConfirm}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              <span>Re-crawl Selected ({selectedSchoolIds.length})</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBulkUndo}
              className="px-3 py-1 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo Rejection & Return ({selectedSchoolIds.length})</span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-indigo-100/60 rounded font-medium cursor-pointer"
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
                <th className="py-3 px-4 font-semibold">Previous DQA</th>
                <th className="py-3 px-4 font-semibold">Citations</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Loading re-crawl queue...</span>
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-medium text-slate-600 block">Re-crawl Queue is Empty</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Schools rejected from the Verification Queue will appear here for agent re-scraping and correction.
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
                        isSelected ? 'bg-indigo-50/40' : ''
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
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-full font-semibold text-[10px] uppercase tracking-wide">
                          Rejected
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {school.dqa_score !== null && school.dqa_score !== undefined ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded text-[11px]">
                            {school.dqa_score}/100
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
                            title="Inspect Details & Citations"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleUndoSingle(school)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer transition-colors shadow-2xs"
                            title="Undo Rejection (Return to Verification Queue)"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Undo</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRecrawlSingle(school)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md cursor-pointer transition-colors shadow-2xs"
                            title="Run Agent Re-crawl for this School"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Re-crawl</span>
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

      {/* Side Slide Drawer */}
      <SchoolEvidenceDrawer
        school={selectedSchool}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        queueType="recrawl"
        isProcessing={isProcessing}
        onUndo={handleUndoSingle}
        onRecrawl={handleRecrawlSingle}
      />

      {/* Confirmation Modal for Batch Re-crawl */}
      {confirmRecrawlBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700 flex-shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Dispatch Batch Re-crawl?</h3>
                <p className="text-xs text-slate-500">
                  This will dispatch the {selectedProductKey === 'info' ? 'Metadata Extraction' : selectedProductKey} Agent for all {filteredSchools.length} rejected school(s) in this batch. Upon crawl completion, schools will automatically return to the Verification Queue.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRecrawlBatch(false)}
                disabled={isProcessing}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecrawlBatchConfirm}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-2xs"
              >
                {isProcessing ? 'Dispatching...' : 'Dispatch Re-crawl'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
