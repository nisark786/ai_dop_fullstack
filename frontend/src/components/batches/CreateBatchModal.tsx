import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle, AlertTriangle, ChevronRight, Download } from 'lucide-react';
import { api } from '../../services/api';
import type { BatchUploadPreviewResponse, BatchConfirmCreateRequest, IntakeRowPreview } from '../../types';

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (batchId: string) => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<number>(1);
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<BatchUploadPreviewResponse | null>(null);
  
  const [isConfirming, setIsConfirming] = useState(false);
  const [resolutions, setResolutions] = useState<Record<number, 'link' | 'create'>>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await api.previewBatchUpload(file);
      setPreview(result);
      
      // Initialize resolutions for duplicates to 'link' by default
      const defaultResolutions: Record<number, 'link' | 'create'> = {};
      result.rows.forEach((r: IntakeRowPreview) => {
        if (r.potential_duplicate) {
          defaultResolutions[r.row_number] = 'link';
        }
      });
      setResolutions(defaultResolutions);
      
      setStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrorBanner(`Upload failed: ${message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setIsConfirming(true);
    setErrorBanner(null);
    try {
      const payload: BatchConfirmCreateRequest = {
        name: batchName,
        description: description || null,
        source_type: 'excel_upload',
        rows: preview.rows
          .filter(r => r.is_valid)
          .map(r => {
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
              action,
              link_school_id
            };
          })
      };
      
      const result = await api.confirmBatchUpload(payload);
      onSuccess(result.batch.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setErrorBanner(`Failed to create batch: ${message}`);
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Create New Batch
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* In-Modal Error Banner */}
        {errorBanner && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-rose-500 hover:text-rose-700 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          
          {step === 1 && (
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch Name *</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. Dallas ISD Fall Intake"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  disabled={batchName.trim().length < 3}
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="flex justify-between items-center bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
                <span>Use our standard template to ensure smooth validation.</span>
                <a
                  href={api.getTemplateDownloadUrl()}
                  download
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-blue-700 rounded-md shadow-sm font-medium hover:bg-blue-50 border border-blue-200"
                >
                  <Download className="w-4 h-4" /> Template
                </a>
              </div>
              
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                aria-busy={isUploading}
              >
                {isUploading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                    <p className="text-slate-600 font-medium">Analyzing file & detecting duplicates...</p>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-800">Click to upload Excel or CSV</h3>
                    <p className="text-sm text-slate-500 mt-2">Maximum file size 10MB</p>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
                  <div className="text-2xl font-bold text-slate-800">{preview.total_rows}</div>
                  <div className="text-xs font-medium text-slate-500 uppercase">Total Rows</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200 text-center">
                  <div className="text-2xl font-bold text-green-600">{preview.valid_rows_count}</div>
                  <div className="text-xs font-medium text-green-600 uppercase">Valid</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200 text-center">
                  <div className="text-2xl font-bold text-red-600">{preview.invalid_rows_count}</div>
                  <div className="text-xs font-medium text-red-600 uppercase">Invalid</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-amber-200 text-center">
                  <div className="text-2xl font-bold text-amber-600">{preview.duplicates_count}</div>
                  <div className="text-xs font-medium text-amber-600 uppercase">Duplicates</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 font-medium">Row</th>
                      <th className="px-4 py-3 font-medium">School</th>
                      <th className="px-4 py-3 font-medium">Status / Match</th>
                      <th className="px-4 py-3 font-medium text-right">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map(row => (
                      <tr key={row.row_number} className={!row.is_valid ? "bg-red-50/50" : row.potential_duplicate ? "bg-amber-50/30" : ""}>
                        <td className="px-4 py-3 text-slate-500">#{row.row_number}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.name || <span className="text-red-500 italic">Missing Name</span>}
                          {row.website && <div className="text-xs text-slate-500 font-normal">{row.website}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {!row.is_valid ? (
                            <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                              <AlertTriangle className="w-4 h-4" /> {row.validation_errors.join(', ')}
                            </span>
                          ) : row.potential_duplicate ? (
                            <div className="flex items-start gap-1 text-amber-700 text-xs">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <div>
                                <span className="font-semibold block">Matched DB Record:</span>
                                {row.potential_duplicate.existing_school_name}
                                {row.potential_duplicate.existing_website && ` (${row.potential_duplicate.existing_website})`}
                              </div>
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle className="w-4 h-4" /> Valid (New Entity)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.potential_duplicate && (
                            <div className="inline-flex bg-slate-100 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setResolutions(prev => ({ ...prev, [row.row_number]: 'link' }))}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                  resolutions[row.row_number] === 'link' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Link Existing
                              </button>
                              <button
                                type="button"
                                onClick={() => setResolutions(prev => ({ ...prev, [row.row_number]: 'create' }))}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                  resolutions[row.row_number] === 'create' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'
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
              
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isConfirming || preview.valid_rows_count === 0}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isConfirming ? (
                    <><div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin" /> Committing...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Confirm & Create Batch ({preview.valid_rows_count} {preview.valid_rows_count === 1 ? 'School' : 'Schools'})</>
                  )}
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};
