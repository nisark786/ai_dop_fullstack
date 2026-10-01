import React, { useEffect, useState } from 'react';
import { Pencil, X, Search, Plus, Building2, UserMinus, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import type { BatchDetailSchoolItem, BatchSummaryItem, School } from '../../types';

interface EditBatchModalProps {
  batch: BatchSummaryItem | null;
  onClose: () => void;
  onBatchUpdated: () => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export const EditBatchModal: React.FC<EditBatchModalProps> = ({
  batch,
  onClose,
  onBatchUpdated,
  showNotification,
}) => {
  const [editTab, setEditTab] = useState<'info' | 'schools'>('info');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSchools, setEditSchools] = useState<BatchDetailSchoolItem[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // Add school states
  const [isAddingSchool, setIsAddingSchool] = useState(false);
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

  useEffect(() => {
    if (batch) {
      setEditName(batch.name);
      setEditDescription(batch.description || '');
      setEditTab('info');
      setIsAddingSchool(false);
      setLibraryResults([]);
      setLibrarySearch('');

      setIsLoadingSchools(true);
      api
        .getBatchDetail(batch.id)
        .then((detail) => setEditSchools(detail.schools || []))
        .catch(() => setEditSchools([]))
        .finally(() => setIsLoadingSchools(false));
    }
  }, [batch]);

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
        const existingIds = new Set(editSchools.map((s) => s.school_id));
        setLibraryResults(results.filter((r) => !existingIds.has(r.id)));
      } catch (err) {
        console.error('Failed to search schools', err);
      } finally {
        setIsSearchingLibrary(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [librarySearch, addMode, editSchools]);

  if (!batch) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.updateBatch(batch.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      showNotification(`Batch "${editName.trim()}" updated successfully.`);
      onBatchUpdated();
      onClose();
    } catch (err: any) {
      console.error('Failed to update batch', err);
      showNotification(err?.message || 'Failed to update batch.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSchool = async (schoolId?: string) => {
    setIsSubmitting(true);
    try {
      let addedSchool: BatchDetailSchoolItem;
      if (schoolId) {
        addedSchool = await api.addSchoolToBatch(batch.id, { school_id: schoolId });
      } else {
        if (!manualName.trim()) {
          showNotification('School name is required.', 'error');
          setIsSubmitting(false);
          return;
        }
        if (!manualWebsite.trim() && !manualAddress.trim()) {
          showNotification('Either Website or Address must be provided.', 'error');
          setIsSubmitting(false);
          return;
        }
        addedSchool = await api.addSchoolToBatch(batch.id, {
          name: manualName.trim(),
          website: manualWebsite.trim() || null,
          address: manualAddress.trim() || null,
          district: manualDistrict.trim() || null,
          state: manualState.trim() || null,
        });
      }

      setEditSchools((prev) => [addedSchool, ...prev]);
      showNotification(`School "${addedSchool.name}" added to batch.`);
      setLibrarySearch('');
      setLibraryResults([]);
      setManualName('');
      setManualWebsite('');
      setManualAddress('');
      setManualDistrict('');
      setManualState('');
      setIsAddingSchool(false);
      onBatchUpdated();
    } catch (err: any) {
      console.error('Failed to add school', err);
      showNotification(err?.message || 'Failed to add school to batch.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDropSchool = async () => {
    if (!droppingSchool) return;

    setIsSubmitting(true);
    try {
      await api.dropSchoolFromBatch(batch.id, String(droppingSchool.school_id));
      setEditSchools((prev) => prev.filter((s) => s.school_id !== droppingSchool.school_id));
      showNotification(`"${droppingSchool.name}" removed from batch.`);
      setDroppingSchool(null);
      onBatchUpdated();
    } catch (err: any) {
      console.error('Failed to drop school', err);
      showNotification(err?.message || 'Failed to remove school from batch.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEditSchools = editSchools.filter(
    (s) =>
      s.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
      (s.district && s.district.toLowerCase().includes(schoolSearchQuery.toLowerCase())) ||
      (s.state && s.state.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Edit Batch: <span className="text-[#0A1F3C]">{batch.name}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setEditTab('info')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              editTab === 'info'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Batch Information
          </button>
          <button
            type="button"
            onClick={() => setEditTab('schools')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer inline-flex items-center gap-2 ${
              editTab === 'schools'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Manage Schools</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold">
              {editSchools.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {editTab === 'info' ? (
            /* TAB 1: BATCH INFO */
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Batch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Q4 Texas High Schools Intake"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Optional operational notes or pipeline intent..."
                />
              </div>

              <div className="pt-2 text-xs text-slate-400">
                Source: <span className="font-semibold text-slate-600">{batch.source_type}</span> • Created:{' '}
                <span className="font-semibold text-slate-600">
                  {new Date(batch.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editName.trim()}
                  className="px-4 py-2 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: MANAGE SCHOOLS */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter member schools..."
                    value={schoolSearchQuery}
                    onChange={(e) => setSchoolSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingSchool(!isAddingSchool)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    isAddingSchool
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-[#0A1F3C] text-white hover:bg-[#12305C]'
                  }`}
                >
                  {isAddingSchool ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isAddingSchool ? 'Close Add Form' : 'Add School to Batch'}</span>
                </button>
              </div>

              {/* Add School Drawer */}
              {isAddingSchool && (
                <div className="p-4 bg-slate-50 rounded-xl border border-blue-100 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Add School Options</span>
                    </span>
                    <div className="inline-flex bg-white border border-slate-200 rounded-md p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setAddMode('library')}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          addMode === 'library' ? 'bg-blue-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Link from Library
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode('manual')}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          addMode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-600'
                        }`}
                      >
                        Create New School
                      </button>
                    </div>
                  </div>

                  {addMode === 'library' ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search master school library (e.g. Austin, Dallas, High School)..."
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      {isSearchingLibrary && (
                        <div className="text-xs text-slate-400 py-1 flex items-center gap-1.5">
                          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span>Searching schools database...</span>
                        </div>
                      )}

                      {libraryResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg shadow-2xs">
                          {libraryResults.map((sch) => (
                            <div
                              key={sch.id}
                              className="px-3 py-2 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-800">{sch.name}</div>
                                <div className="text-[11px] text-slate-400">
                                  {sch.address || sch.website || 'No address provided'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddSchool(sch.id)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-semibold rounded hover:bg-blue-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {librarySearch.trim() && !isSearchingLibrary && libraryResults.length === 0 && (
                        <div className="text-xs text-slate-400 py-2 text-center bg-white rounded-lg border border-dashed border-slate-200">
                          No matching unlinked schools found.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            School Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            placeholder="School Name"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Website</label>
                          <input
                            type="url"
                            value={manualWebsite}
                            onChange={(e) => setManualWebsite(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Address</label>
                          <input
                            type="text"
                            value={manualAddress}
                            onChange={(e) => setManualAddress(e.target.value)}
                            placeholder="123 Street Ave"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">District</label>
                          <input
                            type="text"
                            value={manualDistrict}
                            onChange={(e) => setManualDistrict(e.target.value)}
                            placeholder="District ISD"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">State</label>
                          <input
                            type="text"
                            maxLength={2}
                            value={manualState}
                            onChange={(e) => setManualState(e.target.value.toUpperCase())}
                            placeholder="TX"
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddSchool()}
                          disabled={isSubmitting || !manualName.trim()}
                          className="px-3 py-1.5 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add New School to Batch</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {isLoadingSchools ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                      <span>Loading member schools...</span>
                    </div>
                  ) : filteredEditSchools.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No schools in this batch match the filter.
                    </div>
                  ) : (
                    filteredEditSchools.map((s) => (
                      <div
                        key={s.school_id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                      >
                        <div className="pr-3">
                          <div className="font-bold text-slate-800 text-xs">{s.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {s.district && <span>{s.district}</span>}
                            {s.state && <span>({s.state})</span>}
                            {s.address && <span>• {s.address}</span>}
                            {s.website && (
                              <a
                                href={s.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                <span>Web</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setDroppingSchool(s)}
                          disabled={isSubmitting}
                          className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                          title="Drop school from this batch"
                        >
                          <UserMinus className="w-3.5 h-3.5 text-rose-500" />
                          <span>Drop</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drop School Confirmation Modal */}
      {droppingSchool && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <UserMinus className="w-4 h-4 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">Remove from Batch?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Remove <span className="font-semibold text-slate-800">"{droppingSchool.name}"</span> from batch <span className="font-semibold text-slate-800">"{batch.name}"</span>?
                </p>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDroppingSchool(null)}
                disabled={isSubmitting}
                className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDropSchool}
                disabled={isSubmitting}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
