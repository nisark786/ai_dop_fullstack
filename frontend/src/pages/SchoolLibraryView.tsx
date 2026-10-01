import React, { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { School, UserRole } from '../types';
import { api, type AuditReport } from '../services/api';
import { useSchoolStore } from '../stores/schoolStore';
import { useAppStore } from '../stores/appStore';
import { SchoolDetailModal } from '../components/schools/SchoolDetailModal';
import { EditSchoolModal } from '../components/schools/EditSchoolModal';
import { CreateSchoolModal } from '../components/schools/CreateSchoolModal';
import { AssignToBatchModal } from '../components/schools/AssignToBatchModal';
import {
  Search,
  ExternalLink,
  X,
  RotateCw,
  Sparkles,
  MapPin,
  Globe,
  Plus,
  Pencil,
  Eye,
  Layers,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  Trash2,
  Clock,
} from 'lucide-react';

interface SchoolLibraryViewProps {
  currentRole?: UserRole;
  onFeedback?: (msg: string) => void;
}

const AVAILABLE_TYPES = ['Public', 'Charter', 'Private', 'Magnet'];

export const SchoolLibraryView: React.FC<SchoolLibraryViewProps> = ({
  currentRole = 'Admin',
  onFeedback,
}) => {
  const isAdmin = currentRole === 'Admin';
  const showToast = useAppStore((s) => s.showToast);
  const notify = onFeedback || ((msg: string) => showToast(msg, 'info'));

  const {
    schools,
    stats,
    isLoading,
    page,
    pageSize,
    totalSchools,
    totalPages,
    filters,
    selectedSchoolIds,
  } = useSchoolStore(
    useShallow((s) => ({
      schools: s.schools,
      stats: s.stats,
      isLoading: s.isLoading,
      page: s.page,
      pageSize: s.pageSize,
      totalSchools: s.totalSchools,
      totalPages: s.totalPages,
      filters: s.filters,
      selectedSchoolIds: s.selectedSchoolIds,
    }))
  );

  const fetchSchools = useSchoolStore((s) => s.fetchSchools);
  const fetchStats = useSchoolStore((s) => s.fetchStats);
  const setPage = useSchoolStore((s) => s.setPage);
  const setPageSize = useSchoolStore((s) => s.setPageSize);
  const resetFilters = useSchoolStore((s) => s.resetFilters);
  const setFilters = useSchoolStore((s) => s.setFilters);
  const toggleSchoolSelection = useSchoolStore((s) => s.toggleSchoolSelection);
  const selectAllSchools = useSchoolStore((s) => s.selectAllSchools);
  const clearSelection = useSchoolStore((s) => s.clearSelection);
  const updateSchool = useSchoolStore((s) => s.updateSchool);
  const deleteSchool = useSchoolStore((s) => s.deleteSchool);
  const bulkToggleActive = useSchoolStore((s) => s.bulkToggleActive);

  const [localSearch, setLocalSearch] = useState(filters.searchQuery);

  // --- Modal States ---
  const [inspectingSchool, setInspectingSchool] = useState<School | null>(null);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);
  const [isCreatingSchool, setIsCreatingSchool] = useState<boolean>(false);
  const [isAssigningToBatch, setIsAssigningToBatch] = useState<boolean>(false);

  // --- Audit States ---
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ searchQuery: localSearch.trim() });
    clearSelection();
  };

  // --- Selection Handlers ---
  const toggleSelectAll = () => {
    selectAllSchools(schools.map((s) => s.id));
  };

  const toggleSelectSchool = (id: string) => {
    toggleSchoolSelection(id);
  };

  // --- Single School Actions ---
  const handleRunAudit = async (school: School) => {
    setAuditingId(school.id);
    notify(`Running 3-Agent AI Crawl & Reactivation on '${school.name}'...`);
    try {
      const report = await api.runSchoolAudit(school.id);
      setAuditReport(report);
      notify(
        `Audit finished! Score: ${report.overall_score}/100. Status: ${report.status_changed_to}`
      );
      fetchSchools();
    } catch {
      notify(`Audit failed for ${school.name}`);
    } finally {
      setAuditingId(null);
    }
  };

  const handleToggleActive = async (school: School) => {
    const nextActive = !school.is_active;
    const ok = await updateSchool(school.id, {
      is_active: nextActive,
      profile_verification_status: nextActive ? 'verified' : 'unverified',
    });
    if (ok) {
      notify(`Updated '${school.name}' status to ${nextActive ? 'Active' : 'Inactive'}.`);
    } else {
      notify(`Failed to update ${school.name}`);
    }
  };

  const handleDeleteSchool = (school: School) => {
    if (!isAdmin) {
      notify('Only Administrators can delete schools from the master library.');
      return;
    }
    setDeletingSchool(school);
  };

  const handleConfirmDeleteSchool = async () => {
    if (!deletingSchool) return;
    const ok = await deleteSchool(deletingSchool.id);
    if (ok) {
      notify(`'${deletingSchool.name}' moved to Trash Bucket (retained for 30 days).`);
      setDeletingSchool(null);
    } else {
      notify(`Failed to delete '${deletingSchool.name}'.`);
    }
  };

  // --- Bulk Actions ---
  const handleBulkToggleActive = async (targetActive: boolean) => {
    const { successCount } = await bulkToggleActive(targetActive);
    notify(`Updated ${successCount} school(s) to ${targetActive ? 'Active' : 'Inactive'}.`);
  };

  const selectedSchoolsList = schools.filter((s) => selectedSchoolIds.has(s.id));

  return (
    <div className="space-y-4">
      {/* Header & Global Stats Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              School Management & Master Directory
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              PostgreSQL
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Authoritative master institution catalog, verification lifecycle, and AI targeting control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreatingSchool(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add School</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchSchools();
              fetchStats();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Total Schools
          </div>
          <div className="text-xl font-bold text-slate-900">
            {stats ? stats.total_schools.toLocaleString() : '...'}
          </div>
          <div className="text-[10px] text-slate-400">Master database catalog</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
            Active Verified
          </div>
          <div className="text-xl font-bold text-emerald-700">
            {stats ? stats.active_schools.toLocaleString() : '...'}
          </div>
          <div className="text-[10px] text-emerald-600/80">Operational & ready for search</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
            Inactive Targets
          </div>
          <div className="text-xl font-bold text-amber-700">
            {stats ? stats.inactive_schools.toLocaleString() : '...'}
          </div>
          <div className="text-[10px] text-amber-600/80">Pending crawler re-verification</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">
            Verified Profiles
          </div>
          <div className="text-xl font-bold text-blue-700">
            {stats ? stats.verified_schools.toLocaleString() : '...'}
          </div>
          <div className="text-[10px] text-blue-600/80">High confidence pass rate</div>
        </div>
      </div>

      {/* Multi-Facet Filter & Search Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
        {/* Top search & status tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search name, city, zip code..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Search
            </button>
          </form>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', 'active', 'inactive'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setFilters({ statusFilter: st });
                  clearSelection();
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  filters.statusFilter === st
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Second row: dropdown filters & toggles */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-500 text-[11px] uppercase">Filters:</span>
          </div>

          {/* Verification Status */}
          <select
            value={filters.verificationFilter}
            onChange={(e) => {
              setFilters({ verificationFilter: e.target.value });
              clearSelection();
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Verifications</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="needs_review">Needs Review</option>
            <option value="unverified">Unverified</option>
          </select>

          {/* School Type */}
          <select
            value={filters.schoolTypeFilter}
            onChange={(e) => {
              setFilters({ schoolTypeFilter: e.target.value });
              clearSelection();
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">All Classifications</option>
            {AVAILABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [f, o] = e.target.value.split('-');
              setFilters({ sortBy: f, sortOrder: o as 'asc' | 'desc' });
              clearSelection();
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="created_at-desc">Recently Added</option>
            <option value="rating-desc">Highest Rating</option>
          </select>

          {/* Missing Website Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto select-none">
            <input
              type="checkbox"
              checked={filters.missingWebsiteOnly}
              onChange={(e) => {
                setFilters({ missingWebsiteOnly: e.target.checked });
                clearSelection();
              }}
              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
            <span className="text-xs text-slate-600 font-medium">Missing Website Only</span>
          </label>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedSchoolIds.size > 0 && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-2 text-blue-900 font-semibold">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
              {selectedSchoolIds.size}
            </span>
            <span>school(s) selected for bulk operation</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAssigningToBatch(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Assign to Batch</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkToggleActive(true)}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Activate
            </button>

            <button
              type="button"
              onClick={() => handleBulkToggleActive(false)}
              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Deactivate
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="text-slate-500 hover:text-slate-800 text-xs px-2 py-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Master Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                <th className="p-3 w-8 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {selectedSchoolIds.size === schools.length && schools.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">School Name / Location</th>
                <th className="p-3">Status & Verification</th>
                <th className="p-3">Official Website</th>
                <th className="p-3">Classification & Grades</th>
                <th className="p-3">Contact</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading schools from database...</span>
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 space-y-2">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                    <div>No schools match your search or filter criteria.</div>
                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();
                        setLocalSearch('');
                      }}
                      className="text-xs text-blue-600 hover:underline cursor-pointer font-medium"
                    >
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : (
                schools.map((sch) => {
                  const isSelected = selectedSchoolIds.has(sch.id);
                  const isAuditingThis = auditingId === sch.id;
                  const displayWebsite = sch.website || sch.url;

                  return (
                    <tr
                      key={sch.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectSchool(sch.id)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* School Name & Location */}
                      <td className="p-3 max-w-xs">
                        <div
                          onClick={() => setInspectingSchool(sch)}
                          className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer truncate"
                          title={sch.name}
                        >
                          {sch.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            {sch.city
                              ? `${sch.city}, ${sch.state || 'TX'}`
                              : sch.address || 'Address pending'}
                          </span>
                        </div>
                      </td>

                      {/* Status & Verification */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                              sch.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                sch.is_active ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>{sch.is_active ? 'Active' : 'Inactive'}</span>
                          </span>

                          <span className="text-[10px] text-slate-500 capitalize">
                            {sch.profile_verification_status || 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Official Website */}
                      <td className="p-3 max-w-[200px]">
                        {displayWebsite ? (
                          <a
                            href={displayWebsite}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline truncate text-xs"
                            title={displayWebsite}
                          >
                            <Globe className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {displayWebsite.replace(/^https?:\/\/(www\.)?/, '')}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Missing (AI can discover)
                          </span>
                        )}
                      </td>

                      {/* Classification & Grades */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(sch.type) && sch.type.length > 0 ? (
                            sch.type.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-semibold border border-blue-200"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">School</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {Array.isArray(sch.grades) && sch.grades.length > 0
                            ? `${sch.grades.length} Grades`
                            : 'Grades unmapped'}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">
                        <div>{sch.phone || 'No phone'}</div>
                        <div className="text-slate-400 truncate max-w-[140px]">
                          {sch.email || 'No email'}
                        </div>
                      </td>

                      {/* Action Menu */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectingSchool(sch)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                            title="Inspect details"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingSchool(sch)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                            title="Edit metadata"
                          >
                            <Pencil className="w-3 h-3 text-slate-500" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRunAudit(sch)}
                            disabled={isAuditingThis}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 cursor-pointer shadow-2xs"
                            title="Run live AI Audit & Reactivation"
                          >
                            <Sparkles
                              className={`w-3 h-3 ${
                                isAuditingThis ? 'animate-spin text-blue-600' : 'text-blue-500'
                              }`}
                            />
                            <span>{isAuditingThis ? 'Auditing...' : 'Audit'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(sch)}
                            className="px-1.5 py-0.5 text-[11px] rounded text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors"
                            title={sch.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {sch.is_active ? 'Deactivate' : 'Activate'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSchool(sch)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors shadow-2xs"
                            title="Delete school"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            <span>Delete</span>
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

        {/* Server-Side Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {totalSchools > 0 ? (page - 1) * pageSize + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(page * pageSize, totalSchools)}
              </strong>{' '}
              of <strong className="text-slate-900">{totalSchools.toLocaleString()}</strong> schools
            </span>

            <div className="flex items-center gap-1">
              <span className="text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-2 font-medium text-xs text-slate-700">
              Page {page} of {Math.max(1, totalPages)}
            </span>

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {inspectingSchool && (
        <SchoolDetailModal
          school={inspectingSchool}
          onClose={() => setInspectingSchool(null)}
          onEdit={(s) => {
            setInspectingSchool(null);
            setEditingSchool(s);
          }}
          onRunAudit={(s) => {
            setInspectingSchool(null);
            handleRunAudit(s);
          }}
        />
      )}

      {editingSchool && (
        <EditSchoolModal
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onUpdated={() => {
            fetchSchools();
            fetchStats();
          }}
          onFeedback={onFeedback}
        />
      )}

      {isCreatingSchool && (
        <CreateSchoolModal
          onClose={() => setIsCreatingSchool(false)}
          onCreated={() => {
            fetchSchools();
            fetchStats();
          }}
          onFeedback={onFeedback}
        />
      )}

      {isAssigningToBatch && (
        <AssignToBatchModal
          selectedSchools={selectedSchoolsList}
          onClose={() => setIsAssigningToBatch(false)}
          onAssigned={() => {
            clearSelection();
            fetchSchools();
          }}
          onFeedback={onFeedback}
        />
      )}

      {/* AI Audit Report Modal */}
      {auditReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  DQA Audit Result: {auditReport.school_name || auditReport.school_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditReport(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">
                  Confidence Score
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {auditReport.overall_score} / 100
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-slate-500">
                  Status Changed To
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border inline-block mt-1 ${
                    auditReport.overall_score >= 75
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {auditReport.status_changed_to ||
                    (auditReport.overall_score >= 75 ? 'Verified (Active)' : 'Needs Review')}
                </span>
              </div>
            </div>

            {/* Extracted Fields Breakdown */}
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-2">
                Extracted & Verified Fields
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {auditReport.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="text-xs p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 capitalize">{rec.field}</span>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                        {rec.confidence}% confidence
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-900 mt-1 break-all font-medium">
                      {String(rec.recommended)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAuditReport(null)}
              className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 cursor-pointer transition-colors shadow-sm"
            >
              Close & Continue
            </button>
          </div>
        </div>
      )}

      {/* Move School to Trash Confirmation Modal */}
      {deletingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Move School to Trash Bucket?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">"{deletingSchool.name}"</span>?
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
                This school will not be permanently deleted immediately. It will be safely retained in the <strong>Trash Bucket</strong> for <strong>30 days</strong>. You can restore it back to the active library at any time during this period.
              </p>
            </div>

            <div className="flex justify-end items-center gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDeletingSchool(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSchool}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
