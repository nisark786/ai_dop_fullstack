import React, { useState, useEffect } from 'react';
import type { PromptTemplate, UserRole } from '../types';
import { api } from '../services/api';
import { RotateCw, CheckCircle2 } from 'lucide-react';

interface PromptStudioViewProps {
  currentRole: UserRole;
  onFeedback?: (msg: string) => void;
}

export const PromptStudioView: React.FC<PromptStudioViewProps> = ({
  currentRole,
  onFeedback,
}) => {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadPrompts = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPrompts();
      setPrompts(data);
    } catch {
      onFeedback?.('Could not load prompts from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handleActivate = (id: string) => {
    if (currentRole !== 'Admin') {
      onFeedback?.('Only Admin can switch active prompt versions.');
      return;
    }
    const target = prompts.find((p) => p.id === id);
    if (!target) return;

    setPrompts((prev) =>
      prev.map((p) => {
        if (p.product_id === target.product_id && p.field_name === target.field_name) {
          return { ...p, active: p.id === id };
        }
        return p;
      })
    );
    onFeedback?.(`Activated prompt ${target.version} for ${target.field_name || target.product_name} (Section 20.3).`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Prompt Studio & Extraction Governance</h1>
          <p className="text-[11px] text-slate-500">
            System Spec Module 21 • Versioned LLM extraction prompts with live approval & correction performance metrics
          </p>
        </div>

        <button
          type="button"
          onClick={loadPrompts}
          disabled={isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs"
        >
          <RotateCw className={`w-3 h-3 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Prompts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prompts.map((p) => (
          <div
            key={p.id}
            className={`bg-white border rounded-md p-3 text-xs space-y-2.5 transition-colors shadow-2xs ${
              p.active || p.is_active ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs">{p.product_name}</span>
                <span className="text-[10px] text-slate-400 font-mono ml-2">{p.version}</span>
              </div>
              {p.active || p.is_active ? (
                <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>ACTIVE</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleActivate(p.id)}
                  className="text-[10px] text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Activate
                </button>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded p-2 text-[11px] font-mono text-slate-700 leading-relaxed">
              {p.prompt_text}
            </div>

            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between text-slate-500">
                <span>Accuracy KPI ({p.total_evaluations} reviews)</span>
                <span className="font-bold text-emerald-600">{p.approval_rate}% Approved</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                <div style={{ width: `${p.approval_rate}%` }} className="bg-emerald-500" title="Approved" />
                <div style={{ width: `${p.correction_rate}%` }} className="bg-blue-500" title="Corrected" />
                <div style={{ width: `${p.rejection_rate}%` }} className="bg-rose-500" title="Rejected" />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 pt-0.5">
                <span>Approve: {p.approval_rate}%</span>
                <span>Correct: {p.correction_rate}%</span>
                <span>Reject: {p.rejection_rate}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
