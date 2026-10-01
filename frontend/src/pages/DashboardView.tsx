import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRole, SchoolStats } from '../types';
import { api } from '../services/api';
import {
  Layers,
  GraduationCap,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface DashboardViewProps {
  currentRole?: UserRole;
  onNavigate?: (tabId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = () => {
  const navigate = useNavigate();
  const [batchCount, setBatchCount] = useState<number>(0);
  const [stats, setStats] = useState<SchoolStats>({
    total_schools: 0,
    active_schools: 0,
    inactive_schools: 0,
    verified_schools: 0,
    pending_schools: 0
  });

  const fetchMetrics = async () => {
    try {
      const [schoolData, batchesData] = await Promise.all([
        api.getSchoolStats().catch(() => null),
        api.getBatches().catch(() => [])
      ]);
      if (schoolData) setStats(schoolData);
      if (batchesData) setBatchCount(batchesData.length);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/batches')}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Operational Batches
            </span>
            <Layers className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {batchCount} {batchCount === 1 ? 'Batch' : 'Batches'}
          </div>
          <div className="text-xs text-indigo-600 mt-1 font-medium flex items-center gap-1">
            <span>Manage school intakes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => navigate('/batches')}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Database Schools
            </span>
            <GraduationCap className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats.total_schools.toLocaleString()} Schools
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.active_schools.toLocaleString()} Active ({Math.round((stats.active_schools / (stats.total_schools || 1)) * 100)}%)
          </div>
        </div>

        <div
          onClick={() => navigate('/batches')}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-emerald-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active & Verified
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 tracking-tight">
            {stats.active_schools.toLocaleString()} Active
          </div>
          <div className="text-xs text-emerald-700/80 mt-1 font-medium">
            Ready for Pipeline Crawls
          </div>
        </div>

        <div
          onClick={() => navigate('/batches')}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-amber-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Processing
            </span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 tracking-tight">
            {stats.pending_schools.toLocaleString()} Pending
          </div>
          <div className="text-xs text-amber-600/80 mt-1 font-medium">
            Awaiting Batch Execution
          </div>
        </div>
      </section>

      {/* Featured Callout: Batch Management Primary CTA */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-xl p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-100">
              Active Module • Milestone 1
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">
            Batch Intake & School Management
          </h3>
          <p className="text-sm text-indigo-100 mt-1 max-w-2xl leading-relaxed">
            Upload school intake spreadsheets, preview entity duplicates with automated match detection, and group schools into structured operational batches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/batches')}
          className="px-5 py-2.5 bg-white text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-sm"
        >
          <Layers className="w-4 h-4" />
          <span>Open Batch Manager</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
