import React from 'react';
import { Plus, Info, ExternalLink } from 'lucide-react';

interface PipelineEmptyViewProps {
  title: string;
  subtitle: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  suggestedActionLabel: string;
  specSection?: string;
  onActionClick?: () => void;
}

export const PipelineEmptyView: React.FC<PipelineEmptyViewProps> = ({
  title,
  subtitle,
  category,
  icon: IconComponent,
  description,
  suggestedActionLabel,
  specSection = 'System Spec Module 4 & 21',
  onActionClick,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
              {category}
            </span>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div>
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{suggestedActionLabel}</span>
          </button>
        </div>
      </div>

      {/* Empty State Card */}
      <div className="bg-white border border-slate-200 rounded-md p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xs space-y-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-2 border border-slate-200/80">
          <IconComponent className="w-5 h-5 text-slate-600" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xs font-bold text-slate-800 tracking-tight">
            No Active {title} Configured
          </h2>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3 text-slate-500" />
            <span>Create New {title.replace('Pipelines', 'Pipeline')}</span>
          </button>
        </div>

        {/* Spec Reference Badge */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <Info className="w-3 h-3 text-slate-400" />
          <span>Architecture Ready • Bound to {specSection}</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </div>
      </div>
    </div>
  );
};
