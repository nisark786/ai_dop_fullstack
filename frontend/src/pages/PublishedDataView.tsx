import React, { useState, useEffect } from 'react';
import type { UserRole, PublishedRecord } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { useGovernanceStore } from '../stores/governanceStore';
import { useAppStore } from '../stores/appStore';
import { api } from '../services/api';
import { Download, FileSpreadsheet, FileJson, FileText, RotateCw } from 'lucide-react';

interface PublishedDataViewProps {
  currentRole: UserRole;
  onFeedback?: (msg: string) => void;
}

export const PublishedDataView: React.FC<PublishedDataViewProps> = ({
  onFeedback,
}) => {
  const { records, isLoading } = useGovernanceStore(
    useShallow((s) => ({
      records: s.publishedRecords,
      isLoading: s.isLoadingPublished,
    }))
  );
  const fetchPublishedData = useGovernanceStore((s) => s.fetchPublishedData);
  const showToast = useAppStore((s) => s.showToast);
  const notify = onFeedback || ((msg: string) => showToast(msg, 'info'));

  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishedData();
  }, [fetchPublishedData]);

  const handleExport = (format: 'CSV' | 'Excel' | 'JSON') => {
    notify(`Exporting ${records.length} published records as ${format} (Section 12 FR-9.1)...`);
  };

  const handleRetrySync = async (record: PublishedRecord) => {
    const targetId = record.staging_school_id || record.school_id;
    if (!targetId) return;
    setRetryingId(targetId);
    try {
      const res = await api.retrySandboxSync(targetId);
      if (res.status === 'synced') {
        showToast(
          `Successfully synced "${record.school_name}" to Sandbox (UUID: ${res.sandbox_id || 'OK'})`,
          'success'
        );
      } else {
        showToast(`Sandbox sync retry failed: ${res.error || 'Unknown error'}`, 'error');
      }
      fetchPublishedData();
    } catch (err: any) {
      showToast(err.message || 'Failed to retry Sandbox sync', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = records.filter(
    (r) =>
      r.school_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.district || '').toLowerCase().includes(search.toLowerCase()) ||
      r.product.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Published Golden Datasets</h1>
          <p className="text-[11px] text-slate-500">
            System Spec Module 9 • Approved, trusted datasets with full provenance and downstream export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPublishedData}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs"
          >
            <RotateCw className={`w-3 h-3 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1 inline-flex items-center gap-1">
              <Download className="w-3 h-3 text-slate-400" />
              <span>Export:</span>
            </span>
            <button
              type="button"
              onClick={() => handleExport('CSV')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3 h-3 text-slate-400" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('Excel')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('JSON')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer shadow-2xs"
            >
              <FileJson className="w-3 h-3 text-amber-600" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white border border-slate-200 rounded p-2.5 text-xs">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by school name, district, or product..."
          className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Published Records Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                <th className="p-2.5">Record ID</th>
                <th className="p-2.5">School Name & District</th>
                <th className="p-2.5">Data Product</th>
                <th className="p-2.5 font-bold text-slate-900">Verified Golden Value</th>
                <th className="p-2.5">Confidence</th>
                <th className="p-2.5">Published Date</th>
                <th className="p-2.5">Sandbox Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const syncStatus = r.sandbox_sync?.status;
                const targetId = r.staging_school_id || r.school_id;
                const isRetrying = retryingId === targetId;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-2.5 font-mono text-[11px] text-slate-600">{r.id}</td>
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">{r.school_name}</div>
                      <span className="text-[10px] text-slate-400">{r.district}</span>
                    </td>
                    <td className="p-2.5">
                      <span className="text-slate-800 font-medium">{r.product}</span>
                      <span className="text-[10px] text-slate-400 block">{r.academic_year}</span>
                    </td>
                    <td className="p-2.5">
                      <span className="font-mono font-bold text-slate-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                        {r.verified_value}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="font-semibold text-slate-800">{r.confidence_score}%</span>
                    </td>
                    <td className="p-2.5 text-[11px] text-slate-500">{r.published_at}</td>
                    <td className="p-2.5">
                      {syncStatus === 'synced' ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title={r.sandbox_sync?.sandbox_id ? `Sandbox UUID: ${r.sandbox_sync.sandbox_id}` : 'Synced to RDS Sandbox'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Sandbox Synced
                        </span>
                      ) : syncStatus === 'failed' ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200"
                            title={r.sandbox_sync?.error || 'Failed to sync to Sandbox'}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Sandbox Failed
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRetrySync(r)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 hover:bg-red-200 text-red-800 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
                            title="Retry pushing verified core attributes to AWS RDS Sandbox"
                          >
                            <RotateCw className={`w-2.5 h-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                            <span>Retry Sandbox Sync</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Sandbox Disabled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
