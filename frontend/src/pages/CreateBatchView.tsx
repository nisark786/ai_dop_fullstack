import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle,
  X,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  BatchUploadPreviewResponse,
  BatchConfirmCreateRequest,
  IntakeRowPreview,
} from '../types';

export const CreateBatchView: React.FC = () => {
  const navigate = useNavigate();
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<BatchUploadPreviewResponse | null>(null);

  const [isConfirming, setIsConfirming] = useState(false);
  const [resolutions, setResolutions] = useState<Record<number, 'link' | 'create'>>({});
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await api.previewBatchUpload(file);
      setPreview(result);

      // Default all duplicate matches to 'link'
      const defaultResolutions: Record<number, 'link' | 'create'> = {};
      result.rows.forEach((r: IntakeRowPreview) => {
        if (r.potential_duplicate) {
          defaultResolutions[r.row_number] = 'link';
        }
      });
      setResolutions(defaultResolutions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showNotification(`Upload failed: ${message}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setPreview(null);
    setResolutions({});
  };

  const handleConfirm = async () => {
    if (!preview || !batchName.trim()) return;
    setIsConfirming(true);
    try {
      const payload: BatchConfirmCreateRequest = {
        name: batchName.trim(),
        description: description.trim() || null,
        source_type: 'excel_upload',
        rows: preview.rows
          .filter((r) => r.is_valid)
          .map((r) => {
            let action = 'create';
            let link_school_id = null;

            if (r.potential_duplicate) {
              action = resolutions[r.row_number] || 'link';
              if (action === 'link') {
                link_school_id = r.potential_duplicate.existing_school_id;
              }
            }

            return {
              name: r.name,
              website: r.website,
              address: r.address,
              district: r.district,
              state: r.state,
              phone: r.phone,
              email: r.email,
              type: r.type,
              grades: r.grades,
              action,
              link_school_id,
            };
          }),
      };

      const result = await api.confirmBatchUpload(payload);
      navigate(`/batches/${result.batch.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showNotification(`Failed to create batch: ${message}`, 'error');
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2.5 transition-all ${
            notification.type === 'success'
              ? 'bg-[#0A1F3C] text-white border border-blue-400/30'
              : 'bg-rose-700 text-white border border-rose-500'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-300" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/batches')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Batches</span>
        </button>
        <div>
          <h2 className="text-xl font-bold text-[#0A1F3C]">Create New Batch</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Follow the 3-step progressive intake to name, upload, and validate your school batch.
          </p>
        </div>
      </div>

      {/* Card 1: Name the batch */}
      <div className="card">
        <div className="ch">
          <span>1. Name the batch</span>
        </div>
        <div className="cb space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="bn">
              Batch name *
            </label>
            <input
              id="bn"
              type="text"
              autoFocus
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Houston Campuses Q3"
              className="w-full max-w-md px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="bdesc">
              Description (Optional)
            </label>
            <input
              id="bdesc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational notes, intake campaign, or target district"
              className="w-full max-w-lg px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Card 2: Upload the school list */}
      <div className="card">
        <div className="ch">
          <span>2. Upload the school list</span>
          <a
            href={api.getTemplateDownloadUrl()}
            download
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download template</span>
          </a>
        </div>
        <div className="cb">
          {!preview ? (
            <div
              className="drop cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              aria-busy={isUploading}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-9 h-9 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-slate-700">
                    Parsing file and analyzing duplicate entities...
                  </p>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-12 h-12 text-slate-400" />
                  <div className="text-sm font-semibold text-[#0A1F3C]">
                    Drop an Excel file here or click to browse
                  </div>
                  <div className="text-xs text-slate-500">
                    Columns: Name, Website, Address, District, State (.xlsx or .csv)
                  </div>
                  <button
                    type="button"
                    className="mt-2 px-4 py-2 bg-[#0A1F3C] text-white text-xs font-semibold rounded-lg hover:bg-[#12305C] transition-colors"
                  >
                    Select File
                  </button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="file-box justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                <div>
                  <div className="text-sm font-bold text-slate-900">{preview.filename}</div>
                  <div className="text-xs text-slate-500">
                    {preview.total_rows} rows read • {preview.valid_rows_count} valid •{' '}
                    {preview.invalid_rows_count} invalid
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Remove file</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Validation preview */}
      {preview && (
        <div className="card">
          <div className="ch">
            <span>3. Validation preview</span>
            <div className="flex items-center gap-2">
              <span className="chip chip-verified">
                <CheckCircle className="w-3.5 h-3.5" />
                {preview.valid_rows_count} verified
              </span>
              {preview.duplicates_count > 0 && (
                <span className="chip chip-review">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {preview.duplicates_count} needs review
                </span>
              )}
              {preview.invalid_rows_count > 0 && (
                <span className="chip chip-invalid">
                  <X className="w-3.5 h-3.5" />
                  {preview.invalid_rows_count} invalid
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F8FAFC] border-b border-[#EEF2F7] text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-3 w-12">#</th>
                  <th className="px-5 py-3">School Name</th>
                  <th className="px-5 py-3">Address</th>
                  <th className="px-5 py-3">Website</th>
                  <th className="px-5 py-3">Row Status</th>
                  <th className="px-5 py-3 text-right">Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7] bg-white">
                {preview.rows.map((row) => (
                  <tr
                    key={row.row_number}
                    className={
                      !row.is_valid
                        ? 'bg-red-50/40'
                        : row.potential_duplicate
                        ? 'bg-amber-50/40'
                        : 'hover:bg-slate-50/70'
                    }
                  >
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                      {row.row_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#0A1F3C]">
                        {row.name || <span className="text-red-600 italic">Missing Name</span>}
                      </div>
                      {!row.is_valid && (
                        <div className="why">
                          {row.validation_errors.join(' • ')}
                        </div>
                      )}
                      {row.potential_duplicate && (
                        <div className="text-xs text-amber-700 mt-1 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Matched in DB: {row.potential_duplicate.existing_school_name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {row.address || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {row.website ? (
                        <a
                          href={row.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {row.website}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {!row.is_valid ? (
                        <span className="chip chip-invalid">Invalid</span>
                      ) : row.potential_duplicate ? (
                        <span className="chip chip-review">Possible Match</span>
                      ) : (
                        <span className="chip chip-verified">Ready</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.potential_duplicate && (
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() =>
                              setResolutions((prev) => ({ ...prev, [row.row_number]: 'link' }))
                            }
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                              resolutions[row.row_number] === 'link'
                                ? 'bg-[#0A1F3C] text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Link Existing
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setResolutions((prev) => ({ ...prev, [row.row_number]: 'create' }))
                            }
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                              resolutions[row.row_number] === 'create'
                                ? 'bg-[#0A1F3C] text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Create New
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="ch bg-[#F8FAFC]">
            <span className="text-xs text-slate-500 font-normal">
              {preview.valid_rows_count} valid {preview.valid_rows_count === 1 ? 'school' : 'schools'} will be imported. Invalid rows are automatically excluded.
            </span>
            <button
              type="button"
              disabled={isConfirming || preview.valid_rows_count === 0 || !batchName.trim()}
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-[#0A1F3C] text-white text-xs font-bold rounded-lg hover:bg-[#12305C] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isConfirming ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating batch...</span>
                </>
              ) : (
                <>
                  <span>Confirm and create batch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
