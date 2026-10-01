import React from 'react';
import { Trash2, Clock, RotateCcw, ExternalLink, School as SchoolIcon } from 'lucide-react';
import type { SchoolTrashItem } from '../../types';

interface TrashSchoolsTableProps {
  trashSchools: SchoolTrashItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  onRestore: (school: SchoolTrashItem) => void;
  onDeletePermanent: (school: SchoolTrashItem) => void;
}

export const TrashSchoolsTable: React.FC<TrashSchoolsTableProps> = ({
  trashSchools,
  isLoading,
  isSubmitting,
  onRestore,
  onDeletePermanent,
}) => {
  return (
    <table className="w-full text-left text-sm whitespace-nowrap">
      <thead className="bg-[#FFF5F5] border-b border-[#FEE2E2] text-rose-700 uppercase text-[11px] font-semibold tracking-wider">
        <tr>
          <th className="px-6 py-3.5">School Name</th>
          <th className="px-6 py-3.5">Type</th>
          <th className="px-6 py-3.5">Website</th>
          <th className="px-6 py-3.5">Deleted On</th>
          <th className="px-6 py-3.5">Retention Status</th>
          <th className="px-6 py-3.5 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#EEF2F7] bg-white">
        {isLoading ? (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                <p className="text-xs font-semibold">Loading trash bucket...</p>
              </div>
            </td>
          </tr>
        ) : trashSchools.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-16 text-center">
              <SchoolIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700 text-sm">No schools in trash bucket</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Schools deleted from the Master School Library will appear here for 30 days before permanent deletion.
              </p>
            </td>
          </tr>
        ) : (
          trashSchools.map((school) => {
            const days = school.days_remaining ?? 30;
            const location = [school.city, school.state].filter(Boolean).join(', ');
            const typeStr = Array.isArray(school.type) && school.type.length > 0 ? school.type.join(', ') : 'School';
            return (
              <tr key={school.id} className="hover:bg-rose-50/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{school.name}</div>
                  {location && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">
                      {location}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-600 font-medium">
                    {typeStr}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {school.website ? (
                    <a
                      href={school.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 max-w-[200px] truncate"
                    >
                      <span>{school.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No URL</span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  {school.deleted_at
                    ? new Date(school.deleted_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recently'}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      days <= 5
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{days === 0 ? 'Purging today' : `${days} days left`}</span>
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestore(school)}
                      disabled={isSubmitting}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                      title="Restore school back to active library"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePermanent(school)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 bg-white text-rose-700 text-xs font-medium rounded-md border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Delete permanently from database"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span className="hidden sm:inline">Delete Forever</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
};
