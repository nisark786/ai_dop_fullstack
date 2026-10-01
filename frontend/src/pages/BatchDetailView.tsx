import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Search,
  ExternalLink,
  Plus,
  UserMinus,
  Building2,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pause,
  Play,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type {
  BatchDetailSchoolItem,
  School,
} from '../types';
import { useShallow } from 'zustand/react/shallow';
import { useBatchStore } from '../stores/batchStore';
import { useAppStore } from '../stores/appStore';

export const BatchDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data,
    allBatches,
    isLoading,
    storeError,
  } = useBatchStore(
    useShallow((s) => ({
      data: s.selectedBatch,
      allBatches: s.batches,
      isLoading: s.isLoading,
      storeError: s.error,
    }))
  );

  const fetchBatchDetail = useBatchStore((s) => s.fetchBatchDetail);
  const fetchBatches = useBatchStore((s) => s.fetchBatches);
  const addSchoolToBatch = useBatchStore((s) => s.addSchoolToBatch);
  const dropSchoolFromBatch = useBatchStore((s) => s.dropSchoolFromBatch);

  const showToast = useAppStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState('');

  // Add School Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'library' | 'manual'>('library');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryResults, setLibraryResults] = useState<School[]>([]);
  const [isSearchingLibrary, setIsSearchingLibrary] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualWebsite, setManualWebsite] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualDistrict, setManualDistrict] = useState('');
  const [manualState, setManualState] = useState('');
  const [droppingSchool, setDroppingSchool] = useState<BatchDetailSchoolItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    showToast(message, type);
  };

  const loadBatchDetail = async (batchId: string) => {
    try {
      await Promise.all([
        fetchBatchDetail(batchId),
        fetchBatches(),
      ]);
    } catch (err) {
      console.error('Failed to load batch detail', err);
    }
  };

  useEffect(() => {
    if (id) {
      loadBatchDetail(id);
    }
  }, [id]);

  // Search existing schools from library
  useEffect(() => {
    if (!librarySearch.trim() || addMode !== 'library') {
      setLibraryResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingLibrary(true);
      try {
        const results = await api.getSchools({ search: librarySearch.trim(), limit: 8 });
        const existingIds = new Set((data?.schools || []).map((s) => s.school_id));
        setLibraryResults(results.filter((r) => !existingIds.has(r.id)));
      } catch (err) {
        console.error('Failed to search schools', err);
      } finally {
        setIsSearchingLibrary(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [librarySearch, addMode, data?.schools]);

  const handleAddSchool = async (schoolId?: string) => {
    if (!id) return;

    if (!schoolId) {
      if (!manualName.trim()) {
        showNotification('School name is required.', 'error');
        return;
      }
      if (!manualWebsite.trim() && !manualAddress.trim()) {
        showNotification('Either Website or Address must be provided.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    const success = await addSchoolToBatch(
      id,
      schoolId
        ? { school_id: schoolId }
        : {
            name: manualName.trim(),
            website: manualWebsite.trim() || null,
            address: manualAddress.trim() || null,
            district: manualDistrict.trim() || null,
            state: manualState.trim() || null,
          }
    );
    setIsSubmitting(false);

    if (success) {
      showNotification('School added to batch successfully.');
      setIsAddModalOpen(false);
      setLibrarySearch('');
      setLibraryResults([]);
      setManualName('');
      setManualWebsite('');
      setManualAddress('');
      setManualDistrict('');
      setManualState('');
    } else {
      showNotification(storeError || 'Failed to add school.', 'error');
    }
  };

  const handleConfirmDropSchool = async () => {
    if (!id || !droppingSchool) return;

    setIsSubmitting(true);
    const success = await dropSchoolFromBatch(id, String(droppingSchool.school_id));
    setIsSubmitting(false);

    if (success) {
      showNotification(`"${droppingSchool.name}" removed from batch.`);
      setDroppingSchool(null);
    } else {
      showNotification(storeError || 'Failed to remove school.', 'error');
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading batch details...</p>
      </div>
    );
  }

  const { batch, schools } = data;

  const filteredSchools = schools.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.district && s.district.toLowerCase().includes(q)) ||
      (s.state && s.state.toLowerCase().includes(q))
    );
  });

  const products = [
    { id: 'info', name: 'Profile & Metadata', isPrimary: true },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/batches')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Batches</span>
        </button>
        <span className="text-xs text-slate-400">/</span>
        <span className="text-xs font-bold text-[#0A1F3C]">{batch.name}</span>
      </div>

      {/* Card 1: Batch Header Bar */}
      <div className="card">
        {/* Batch Pills quick switcher */}
        <div className="ch bg-[#F8FAFC] border-b border-[#EEF2F7] py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto w-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Batch:
            </span>
            <div className="pills flex-nowrap shrink-0">
              {allBatches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => navigate(`/batches/${b.id}`)}
                  className={`pill text-xs py-1 px-3 ${
                    b.id === batch.id ? 'on' : ''
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Batch Meta Row */}
        <div className="cb flex flex-wrap items-center gap-6 justify-between">
          <div className="flex flex-wrap items-center gap-6 sm:gap-10">
            <div>
              <div className="text-xl font-extrabold text-[#0A1F3C] tracking-tight">
                {batch.name}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Source: {batch.source_type.replace('_', ' ')}
                {batch.description && ` • ${batch.description}`}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Schools
              </div>
              <div className="text-lg font-bold text-[#0A1F3C]">
                {schools.length}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </div>
              <div>
                <span
                  className={`chip ${
                    batch.status === 'ready'
                      ? 'chip-ready'
                      : batch.status === 'processing'
                      ? 'chip-processing'
                      : batch.status === 'completed'
                      ? 'chip-verified'
                      : batch.status === 'paused'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                      : 'chip-neutral'
                  }`}
                >
                  {batch.status}
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Created
              </div>
              <div className="text-xs font-medium text-slate-700">
                {new Date(batch.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add School</span>
            </button>
          </div>
        </div>
      </div>

      {/* Paused Batch Alert Banner */}
      {batch.status === 'paused' && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-amber-900 font-medium">
            <Pause className="w-4 h-4 text-amber-600 fill-amber-600 shrink-0" />
            <div>
              <span className="font-bold">This batch execution is currently paused.</span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Completed schools and extracted records are safely saved. You can resume processing the remaining unverified schools at any time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/agents/operate')}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Resume in Monitor</span>
            </button>
          </div>
        </div>
      )}

      {/* Card 2: Visual Progress Snapshot */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-bold text-[#0A1F3C]">
            Batch Ingestion Progress
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {schools.length === 0
              ? 'No schools in batch'
              : `${Math.round(
                  (schools.filter(
                    (s) =>
                      s.status === 'verified' ||
                      s.products?.info?.status === 'verified'
                  ).length /
                    schools.length) *
                    100
                )}% Verified`}
          </div>
        </div>

        {(() => {
          const total = schools.length;
          const verifiedCount = schools.filter(
            (s) =>
              s.status === 'verified' ||
              s.products?.info?.status === 'verified'
          ).length;
          const reviewCount = schools.filter(
            (s) =>
              (s.status === 'needs_review' ||
                s.products?.info?.status === 'needs_review') &&
              s.status !== 'verified' &&
              s.products?.info?.status !== 'verified'
          ).length;
          const pendingCount = schools.filter(
            (s) =>
              s.status === 'pending' &&
              s.products?.info?.status !== 'verified' &&
              s.products?.info?.status !== 'needs_review'
          ).length;
          const otherCount = Math.max(
            0,
            total - verifiedCount - reviewCount - pendingCount
          );

          const verifiedPct = total > 0 ? (verifiedCount / total) * 100 : 0;
          const reviewPct = total > 0 ? (reviewCount / total) * 100 : 0;
          const pendingPct = total > 0 ? (pendingCount / total) * 100 : 0;
          const otherPct = total > 0 ? (otherCount / total) * 100 : 0;

          return (
            <div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${verifiedPct}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`Verified: ${verifiedCount}`}
                />
                <div
                  style={{ width: `${reviewPct}%` }}
                  className="bg-amber-400 transition-all duration-500"
                  title={`Needs Review: ${reviewCount}`}
                />
                <div
                  style={{ width: `${pendingPct}%` }}
                  className="bg-blue-400 transition-all duration-500"
                  title={`Pending: ${pendingCount}`}
                />
                <div
                  style={{ width: `${otherPct}%` }}
                  className="bg-slate-300 transition-all duration-500"
                  title={`Queued/Other: ${otherCount}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 mt-3 text-xs text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Verified · {verifiedCount}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Needs Review · {reviewCount}</span>
                </span>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>Pending Processing · {pendingCount}</span>
                  </span>
                )}
                {otherCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span>Queued · {otherCount}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Card 3: School Membership Table */}
      <div className="card">
        <div className="ch flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#0A1F3C]">Batch Schools</span>
            <span className="text-xs text-slate-400 font-normal">
              ({filteredSchools.length} of {schools.length} schools)
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search schools in batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[680px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F8FAFC] border-b border-[#EEF2F7] text-slate-500 uppercase text-[11px] font-semibold tracking-wider sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-5 py-3 min-w-[260px]">School</th>
                {products.map((p) => (
                  <th
                    key={p.id}
                    className={`px-4 py-3 text-center min-w-[110px] ${
                      p.id === 'info' ? 'text-blue-900 bg-blue-50/50 font-bold' : ''
                    }`}
                  >
                    {p.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7] bg-white">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + products.length}
                    className="px-6 py-12 text-center text-slate-500 text-xs font-semibold"
                  >
                    No schools in this batch match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => (
                  <tr
                    key={s.school_id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[#0A1F3C] text-sm">{s.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {s.district && <span>{s.district}</span>}
                        {s.state && <span>({s.state})</span>}
                        {s.website && (
                          <a
                            href={s.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>Link</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Product Status Cells */}
                    {products.map((p) => {
                      if (p.id === 'info') {
                        const info = s.products?.info;
                        const status = info?.status || 'not_run';
                        const score = info?.score;

                        let chipClass = 'bg-slate-100 text-slate-600 border border-slate-200';
                        let label = 'Not Run';
                        let icon: React.ReactNode = null;

                        if (status === 'verified') {
                          chipClass = 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold';
                          label = `Verified ${score !== undefined && score !== null ? `(${score}%)` : ''}`;
                          icon = <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
                        } else if (status === 'needs_review') {
                          chipClass = 'bg-amber-50 text-amber-700 border border-amber-300 font-semibold';
                          label = `Review ${score !== undefined && score !== null ? `(${score}%)` : ''}`;
                          icon = <AlertTriangle className="w-3 h-3 text-amber-600" />;
                        } else if (status === 'running') {
                          chipClass = 'bg-blue-50 text-blue-700 border border-blue-300 font-semibold animate-pulse';
                          label = 'Running...';
                          icon = (
                            <div className="w-2.5 h-2.5 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin" />
                          );
                        } else if (status === 'queued') {
                          chipClass = 'bg-slate-100 text-slate-700 border border-slate-300';
                          label = 'Queued';
                          icon = <Clock className="w-3 h-3 text-slate-500" />;
                        }

                        return (
                          <td key={p.id} className="px-4 py-3.5 text-center bg-blue-50/10">
                            <span
                              className={`text-[11px] py-1 px-2.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs ${chipClass}`}
                            >
                              {icon}
                              <span>{label}</span>
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={p.id} className="px-4 py-3.5 text-center">
                          <span className="chip chip-neutral text-[11px] py-1 px-2.5 w-full max-w-[100px] justify-center inline-flex">
                            Pending
                          </span>
                        </td>
                      );
                    })}

                    {/* School Actions: Only Drop School from Batch */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDroppingSchool(s)}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-xs font-medium rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        title="Remove school from this batch"
                      >
                        <UserMinus className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-[11px] font-medium">Drop</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD SCHOOL MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">Add School to Batch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAddMode('library')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    addMode === 'library'
                      ? 'bg-white text-[#0A1F3C] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Link from Master Library
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('manual')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    addMode === 'manual'
                      ? 'bg-white text-[#0A1F3C] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create New School
                </button>
              </div>

              {addMode === 'library' ? (
                /* Link Existing */
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search existing schools (e.g. Austin, Academy, High School)..."
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      className="pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {isSearchingLibrary && (
                    <div className="text-xs text-slate-400 py-2 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Searching database...</span>
                    </div>
                  )}

                  {libraryResults.length > 0 && (
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white shadow-2xs">
                      {libraryResults.map((sch) => (
                        <div
                          key={sch.id}
                          className="px-3.5 py-2.5 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">{sch.name}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {sch.address || sch.website || 'No address provided'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddSchool(sch.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {librarySearch.trim() && !isSearchingLibrary && libraryResults.length === 0 && (
                    <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                      No matching unlinked schools found.
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Creation Form */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      School Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Austin STEM Academy"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={manualWebsite}
                      onChange={(e) => setManualWebsite(e.target.value)}
                      placeholder="https://www.example.edu"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        placeholder="100 Main St"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        District
                      </label>
                      <input
                        type="text"
                        value={manualDistrict}
                        onChange={(e) => setManualDistrict(e.target.value)}
                        placeholder="Austin ISD"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={manualState}
                        onChange={(e) => setManualState(e.target.value.toUpperCase())}
                        placeholder="TX"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddSchool()}
                      disabled={isSubmitting || !manualName.trim()}
                      className="px-4 py-2 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add School</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drop School Confirmation Modal */}
      {droppingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <UserMinus className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Remove School from Batch?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-slate-800">"{droppingSchool.name}"</span> from this operational batch? The master school record will not be deleted.
                </p>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDroppingSchool(null)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDropSchool}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Removing...' : 'Remove School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BatchDetailView;
