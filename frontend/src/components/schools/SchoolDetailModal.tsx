import React, { useState } from 'react';
import type { School } from '../../types';
import {
  X,
  Globe,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Building2,
  GraduationCap,
  Sparkles,
  Pencil,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface SchoolDetailModalProps {
  school: School;
  onClose: () => void;
  onEdit: (school: School) => void;
  onRunAudit: (school: School) => void;
}

export const SchoolDetailModal: React.FC<SchoolDetailModalProps> = ({
  school,
  onClose,
  onEdit,
  onRunAudit,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'products'>('overview');

  const displayWebsite = school.website || school.url;

  const dataProducts = [
    { key: 'metadata', name: 'Profile & Metadata', agent: 'MetadataAgent', status: school.profile_verification_status || 'pending' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="space-y-1 pr-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  school.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {school.is_active ? 'Active' : 'Inactive'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  school.profile_verification_status === 'verified'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : school.profile_verification_status === 'needs_review'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                Verification: {school.profile_verification_status || 'Pending'}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 truncate" title={school.name}>
              {school.name}
            </h2>
            <p className="text-xs text-slate-500 font-mono">ID: {school.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview & Location
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('academics')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'academics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Academics & Classification
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Agent Products</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">{dataProducts.length}</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              {/* Official Website */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Official Website Portal</span>
                </div>
                {displayWebsite ? (
                  <a
                    href={displayWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold text-sm break-all"
                  >
                    <span>{displayWebsite}</span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                ) : (
                  <div className="text-slate-400 italic">
                    No official portal assigned. Run AI Audit to auto-discover official website via Tavily.
                  </div>
                )}
              </div>

              {/* Physical Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>Physical Address</span>
                  </div>
                  <div className="text-slate-900 font-medium leading-relaxed">
                    {school.address || 'No street address specified'}
                  </div>
                  <div className="text-slate-500">
                    {[school.city, school.state || 'TX', school.zip_code].filter(Boolean).join(', ')}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Contact Info</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{school.phone || 'Phone not registered'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{school.email || 'Email not registered'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  School Overview & Description
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {school.description || 'No descriptive overview recorded yet. Extraction agent will synthesize from official mission statement.'}
                </p>
              </div>

              {/* Audit Timestamps */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Profile Verified: {school.profile_verified_at ? new Date(school.profile_verified_at).toLocaleDateString() : 'Pending verification'}</span>
                </span>
                <span>Updated: {school.updated_at ? new Date(school.updated_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          )}

          {activeTab === 'academics' && (
            <div className="space-y-4 text-xs">
              {/* Classification */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                  <span>Institution Classification</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(school.type) && school.type.length > 0 ? (
                    school.type.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-lg bg-blue-100/80 text-blue-800 font-semibold text-xs border border-blue-200"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">No classification assigned</span>
                  )}
                </div>
              </div>

              {/* Grades Offered */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Grades & Classrooms Offered ({Array.isArray(school.grades) ? school.grades.length : 0})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(school.grades) && school.grades.length > 0 ? (
                    school.grades.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium text-xs border border-emerald-200"
                      >
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Grade levels unmapped</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 pb-1">
                Data product extraction status and verification coverage across AI agents.
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {dataProducts.map((p) => {
                  const isVerified = p.status === 'verified';
                  const isNeedsReview = p.status === 'needs_review';

                  return (
                    <div
                      key={p.key}
                      className="p-3 flex items-center justify-between bg-white hover:bg-slate-50/70 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isVerified ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : isNeedsReview ? (
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.agent}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isNeedsReview
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {isVerified ? 'Verified' : isNeedsReview ? 'Needs Review' : 'Not Run'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onRunAudit(school)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Run AI Audit</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(school)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit School</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
