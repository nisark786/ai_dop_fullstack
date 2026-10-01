import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RotateCw,
  Search,
  FileSpreadsheet,
  FileText,
  FileCode,
  ChevronDown,
  X,
  Building2,
  Globe,
  ExternalLink,
  Award,
  FileCheck,
  Copy,
  Check,
  BookOpen,
  DollarSign,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useResultsStore } from '../stores/resultsStore';
import { useAppStore } from '../stores/appStore';
import type { ResultSchoolItem } from '../types';

const PRODUCT_OPTIONS = [
  { key: 'info', label: 'School Profile & Metadata' },
];

export const ResultsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBatchId = searchParams.get('batch_id');

  const {
    records,
    isLoading,
    isExporting,
    selectedBatchId,
    selectedProductKey,
    searchQuery,
    batches,
    isLoadingBatches,
    selectedRecord,
    isDrawerOpen,
  } = useResultsStore(
    useShallow((s) => ({
      records: s.records,
      isLoading: s.isLoading,
      isExporting: s.isExporting,
      selectedBatchId: s.selectedBatchId,
      selectedProductKey: s.selectedProductKey,
      searchQuery: s.searchQuery,
      batches: s.batches,
      isLoadingBatches: s.isLoadingBatches,
      selectedRecord: s.selectedRecord,
      isDrawerOpen: s.isDrawerOpen,
    }))
  );

  const fetchResults = useResultsStore((s) => s.fetchResults);
  const fetchBatches = useResultsStore((s) => s.fetchBatches);
  const setSelectedBatchId = useResultsStore((s) => s.setSelectedBatchId);
  const setSelectedProductKey = useResultsStore((s) => s.setSelectedProductKey);
  const setSearchQuery = useResultsStore((s) => s.setSearchQuery);
  const openDrawer = useResultsStore((s) => s.openDrawer);
  const closeDrawer = useResultsStore((s) => s.closeDrawer);
  const exportResults = useResultsStore((s) => s.exportResults);
  const showToast = useAppStore((s) => s.showToast);

  const [activeExport, setActiveExport] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    fetchBatches();
    if (urlBatchId) {
      setSelectedBatchId(urlBatchId);
    } else {
      fetchResults();
    }
  }, [fetchBatches, fetchResults, urlBatchId, setSelectedBatchId]);

  // Client-side search filtering for instant responsiveness
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.school_name.toLowerCase().includes(q) ||
        (r.district && r.district.toLowerCase().includes(q)) ||
        (r.website && r.website.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q))
    );
  }, [records, searchQuery]);

  const handleExport = async (format: 'excel' | 'csv' | 'html') => {
    setActiveExport(format);
    try {
      await exportResults(format);
      showToast(`Exported ${format.toUpperCase()} report successfully.`, 'info');
    } catch {
      showToast(`Failed to export ${format.toUpperCase()}`, 'error');
    } finally {
      setActiveExport(null);
    }
  };

  const handleCopyJson = async (record: ResultSchoolItem) => {
    const payload = record.post_ingestion_record || record.extracted_fields || {};
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedJson(true);
      showToast('Copied clean school record JSON to clipboard.', 'info');
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      showToast('Could not copy JSON to clipboard.', 'error');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F172A] text-white shadow-2xs">
            Published
          </span>
        );
      case 'Verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Verified
          </span>
        );
      case 'Needs Verification':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Needs Verification
          </span>
        );
      case 'Completed':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Completed
          </span>
        );
    }
  };

  const renderScorePill = (score: number | null | undefined) => {
    if (score === null || score === undefined) {
      return <span className="text-slate-400 text-xs">—</span>;
    }
    const colorClass =
      score >= 75
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : score > 0
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}`}
      >
        <Award className="w-3 h-3" />
        {score}/100
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Results</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest crawled output, record by record
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchResults()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Informational Callout Banner */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center text-xs text-blue-800 shadow-2xs">
        <span className="leading-relaxed">
          Latest output from each run and review action. Click a school row to inspect the complete 14-field metadata profile, evidence citations, and recommendations.
        </span>
      </div>

      {/* Interactive Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Dropdown Filters & Search Input */}
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
            {/* Batch Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="batch-select" className="text-xs font-medium text-slate-600">
                Batch
              </label>
              <div className="relative">
                <select
                  id="batch-select"
                  value={selectedBatchId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBatchId(val);
                    const next = new URLSearchParams(searchParams);
                    if (val === 'all') {
                      next.delete('batch_id');
                    } else {
                      next.set('batch_id', val);
                    }
                    setSearchParams(next, { replace: true });
                  }}
                  disabled={isLoadingBatches}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs rounded-lg pl-3 pr-8 py-1.5 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.school_count || 0})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Product Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="product-select" className="text-xs font-medium text-slate-600">
                Product
              </label>
              <div className="relative">
                <select
                  id="product-select"
                  value={selectedProductKey}
                  onChange={(e) => setSelectedProductKey(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs rounded-lg pl-3 pr-8 py-1.5 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRODUCT_OPTIONS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* School Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by school, district, website..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Active records count */}
            <div className="text-xs font-medium text-slate-500 pl-1">
              Showing {filteredRecords.length} school{filteredRecords.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 rounded-lg shadow-2xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{activeExport === 'excel' ? 'Exporting...' : 'Export Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 rounded-lg shadow-2xs cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{activeExport === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('html')}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 rounded-lg shadow-2xs cursor-pointer transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-600" />
              <span>{activeExport === 'html' ? 'Generating...' : 'HTML view'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Clean Results Table (No Value 1 / 2 / 3) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <RotateCw className="w-6 h-6 mx-auto animate-spin mb-3 text-blue-600" />
            <span>Loading crawled product output...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <Building2 className="w-8 h-8 mx-auto text-slate-300" />
            <div className="font-semibold text-slate-700">No crawled records found</div>
            <p className="text-slate-400 max-w-sm mx-auto">
              No school results matched the selected batch or product filter. Select another batch or run an agent crawl.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">SCHOOL & DISTRICT</th>
                  <th className="py-3 px-4">OFFICIAL WEBSITE</th>
                  <th className="py-3 px-4">DQA SCORE</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">EVIDENCE</th>
                  <th className="py-3 px-4">CRAWLED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => openDrawer(record)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* School Name & District */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {record.school_name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {record.district || 'Independent District'}
                      </div>
                    </td>

                    {/* Official Website */}
                    <td className="py-3.5 px-4">
                      {record.website ? (
                        <a
                          href={record.website}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline max-w-[220px] truncate"
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{record.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No website</span>
                      )}
                    </td>

                    {/* DQA Score */}
                    <td className="py-3.5 px-4">
                      {renderScorePill(record.overall_score)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(record.status)}
                    </td>

                    {/* Citations Count */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                        <FileCheck className="w-3 h-3 text-slate-500" />
                        {record.evidence_count} citations
                      </span>
                    </td>

                    {/* Crawled Timestamp */}
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {record.crawled_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Inspection Slide-Over Drawer */}
      {isDrawerOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-fade-in">
          <div
            className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-left border-l border-slate-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{selectedRecord.school_name}</h2>
                  {renderStatusBadge(selectedRecord.status)}
                </div>
                <p className="text-xs text-slate-500">
                  {selectedRecord.district || 'Independent District'} • {selectedRecord.batch_name || 'Standard Batch'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
              {/* 1. Core Profile & Contact Details */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Core School Profile & Contact
                  </span>
                  {selectedRecord.overall_score !== null && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[11px] border border-emerald-200">
                      DQA Score: {selectedRecord.overall_score}/100
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Website</span>
                    {selectedRecord.website ? (
                      <a
                        href={selectedRecord.website}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{selectedRecord.website}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Not listed</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Institutional Type</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedRecord.school_type && selectedRecord.school_type.length > 0
                        ? selectedRecord.school_type.join(', ')
                        : 'Private'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Primary Telephone</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {selectedRecord.phone || 'Not listed'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Primary Contact Email</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedRecord.email || 'Not listed'}</span>
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400 block">Physical Address</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      {selectedRecord.address || selectedRecord.district || 'Not listed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Academics, Grades & Learning Model */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-2xs">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  Academics, Grades & Instructional Models
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1.5">Grades / Classrooms Offered</span>
                    {selectedRecord.grades && selectedRecord.grades.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRecord.grades.map((grade) => (
                          <span
                            key={grade}
                            className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-medium text-[11px] border border-slate-200"
                          >
                            {grade}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No grades listed</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Learning Models</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {selectedRecord.learning_models && selectedRecord.learning_models.length > 0
                          ? selectedRecord.learning_models.join(', ').replace(/_/g, ' ')
                          : 'Standard'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Teaching Style</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {selectedRecord.teaching_style
                          ? selectedRecord.teaching_style.replace(/_/g, ' ')
                          : 'Traditional'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Admissions, Capacity & Tuition */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-2xs">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Admissions, Tuition & Capacity
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Open Enrollment</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        selectedRecord.open_enrollment === true
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedRecord.open_enrollment === false
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {selectedRecord.open_enrollment === true
                        ? 'Enrolling Now'
                        : selectedRecord.open_enrollment === false
                        ? 'Waitlist Only'
                        : 'Unspecified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Base Tuition</span>
                    <span className="font-semibold text-slate-800">
                      {selectedRecord.base_tuition || 'Contact School'}
                    </span>
                  </div>

                  {selectedRecord.open_enrollment_grades && selectedRecord.open_enrollment_grades.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-400 block mb-1">Open Enrollment Grades</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedRecord.open_enrollment_grades.map((g) => (
                          <span key={g} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px]">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Description if extracted */}
              {selectedRecord.description && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-1.5 bg-white shadow-2xs">
                  <span className="font-bold text-slate-900 text-xs">School Description</span>
                  <p className="text-slate-600 leading-relaxed text-xs">{selectedRecord.description}</p>
                </div>
              )}

              {/* 5. Recommendations & Evidence Citations */}
              {selectedRecord.recommendations && selectedRecord.recommendations.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-2xs">
                  <div className="font-bold text-slate-900 text-xs">Extraction Citations & Recommendations</div>
                  <div className="space-y-2">
                    {selectedRecord.recommendations.map((rec, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between font-medium">
                          <span className="capitalize text-slate-800 font-semibold">{rec.field}</span>
                          {rec.confidence && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                              {Math.round(rec.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        <div className="text-slate-700 font-mono text-[11px] bg-white p-1.5 rounded border border-slate-200 truncate">
                          {typeof rec.recommended === 'object'
                            ? JSON.stringify(rec.recommended)
                            : String(rec.recommended)}
                        </div>
                        {rec.reason && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">{rec.reason}</p>
                        )}
                        {rec.sources && rec.sources.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-200 space-y-1">
                            {rec.sources.map((s, si) => (
                              <div key={si} className="text-[11px] text-slate-600 bg-slate-100/70 p-1.5 rounded">
                                <span className="font-semibold text-slate-700">Quote:</span> &ldquo;{s.text}&rdquo;
                                {s.url && (
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-[10px] text-blue-600 hover:underline truncate mt-0.5"
                                  >
                                    Source: {s.url}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Raw Clean Post-Ingestion Record (Matching results.json) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">
                    Post-Ingestion Record (results.json)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(selectedRecord)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-950 text-slate-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed max-h-60">
                  {JSON.stringify(
                    selectedRecord.post_ingestion_record || selectedRecord.extracted_fields,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDrawer}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
