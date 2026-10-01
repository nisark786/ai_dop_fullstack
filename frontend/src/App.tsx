import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CopilotDrawer } from './components/CopilotDrawer';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from './stores/appStore';

import { DashboardView } from './pages/DashboardView';
import { SchoolLibraryView } from './pages/SchoolLibraryView';
import { ReviewQueueView } from './pages/ReviewQueueView';
import { ApprovedSchoolsView } from './pages/ApprovedSchoolsView';
import { RecrawlQueueView } from './pages/RecrawlQueueView';
import { JobMonitorView } from './pages/JobMonitorView';
import { PublishedDataView } from './pages/PublishedDataView';
import { SourceRankingView } from './pages/SourceRankingView';
import { PromptStudioView } from './pages/PromptStudioView';
import { PipelineEmptyView } from './pages/PipelineEmptyView';
import { CrawlPipelinesView } from './pages/CrawlPipelinesView';
import { BatchListView } from './pages/BatchListView';
import { BatchDetailView } from './pages/BatchDetailView';
import { CreateBatchView } from './pages/CreateBatchView';
import { AgentsOperateView } from './pages/AgentsOperateView';
import { CostMonitorView } from './pages/CostMonitorView';
import { BatchRunDetailView } from './pages/BatchRunDetailView';
import { ResultsView } from './pages/ResultsView';
import { TrashBucketView } from './pages/TrashBucketView';

import { GitBranch, CalendarClock, AlertOctagon } from 'lucide-react';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Operational Dashboard',
  '/batches': 'Batch Intake & Management',
  '/batches/create': 'Create New Batch',
  '/trash': 'Trash Bucket',
  '/agents': 'Multi-Agent Operations & Orchestration',
  '/results': 'Results',
  '/runs': 'Results',
  '/costs': 'OpenAI Cost & Token Monitor',
  '/schools': 'School Master Library',
  '/jobs': 'Job Monitor & Extraction',
  '/pipelines/crawl': 'Web Crawl & DQA Audit Pipeline',
  '/pipelines/etl': 'ETL Ingestion & Transformation',
  '/pipelines/schedules': 'Automated Crawl Schedules',
  '/pipelines/anomalies': 'Anomaly & Quarantine Queue',
  '/review': 'Verification Queue',
  '/approved': 'Approved Schools',
  '/recrawl': 'Re-crawl Queue',
  '/published': 'Published Datasets',
  '/ranking': 'Source Ranking & Accuracy',
  '/prompts': 'Prompt Studio',
};

export function App() {
  const location = useLocation();
  const { currentRole, isCopilotOpen, toast } = useAppStore(
    useShallow((s) => ({
      currentRole: s.currentRole,
      isCopilotOpen: s.isCopilotOpen,
      toast: s.toast,
    }))
  );
  const setRole = useAppStore((s) => s.setRole);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);
  const showToast = useAppStore((s) => s.showToast);
  const hideToast = useAppStore((s) => s.hideToast);

  const handleRefresh = () => {
    showToast('Refreshed pipeline state and live metrics.', 'info');
  };

  const currentTabName = routeTitles[location.pathname] || 'Operational Overview';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Grouped Minimal Left Sidebar with NavLink */}
      <Sidebar />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Header with RBAC Role Switcher & Copilot Button */}
        <Header
          currentTabName={currentTabName}
          currentRole={currentRole}
          onRoleChange={(newRole) => {
            setRole(newRole);
            showToast(`Role switched to ${newRole}. UI permissions updated (Section 2.1).`, 'info');
          }}
          onOpenCopilot={() => setCopilotOpen(true)}
          onRefresh={handleRefresh}
        />

        {/* Global Toast Notification for Feedback & Learning Loop */}
        {toast && (
          <div
            className={`text-xs px-4 py-2 flex items-center justify-between shadow-md transition-all ${
              toast.type === 'error'
                ? 'bg-rose-900 text-white'
                : toast.type === 'info'
                ? 'bg-blue-900 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{toast.type === 'error' ? '⚠️' : '⚡'}</span>
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={hideToast}
              className="text-slate-400 hover:text-white cursor-pointer ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Screen Content via React Router */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-[1600px] mx-auto overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView currentRole={currentRole} />} />
            <Route path="/batches" element={<BatchListView />} />
            <Route path="/batches/create" element={<CreateBatchView />} />
            <Route path="/batches/:id" element={<BatchDetailView />} />
            <Route path="/trash" element={<TrashBucketView />} />
            <Route path="/agents" element={<AgentsOperateView />} />
            <Route path="/results" element={<ResultsView />} />
            <Route path="/runs" element={<Navigate to="/results" replace />} />
            <Route path="/runs/:jobId" element={<BatchRunDetailView />} />
            <Route path="/costs" element={<CostMonitorView />} />
            <Route path="/schools" element={<SchoolLibraryView currentRole={currentRole} onFeedback={(msg) => showToast(msg, 'info')} />} />
            <Route path="/jobs" element={<JobMonitorView currentRole={currentRole} onFeedback={(msg) => showToast(msg, 'info')} />} />
            
            {/* Pipelines Routes */}
            <Route path="/pipelines/crawl" element={<CrawlPipelinesView />} />
            <Route
              path="/pipelines/etl"
              element={
                <PipelineEmptyView
                  title="ETL Transformation Rules"
                  subtitle="System Spec Section 14 • Field normalization, schema casting & validation"
                  category="Data Engineering"
                  icon={GitBranch}
                  description="Configure mapping pipelines to clean raw agent HTML/JSON payloads into standardized school entity attributes before feeding the ERCIE resolution engine."
                  suggestedActionLabel="Add ETL Transformation"
                  specSection="Spec Section 8 (Data Products & Schema)"
                  onActionClick={() => showToast('New ETL rule builder opened.', 'info')}
                />
              }
            />
            <Route
              path="/pipelines/schedules"
              element={
                <PipelineEmptyView
                  title="Automated Crawl Schedules"
                  subtitle="System Spec Section 10 & 21.2 • Recurring sync intervals (Daily to Quarterly)"
                  category="Scheduler Service"
                  icon={CalendarClock}
                  description="Set up recurring cron schedules to re-crawl school portals automatically. Scheduled runs spawn one-time requests and trigger notifications."
                  suggestedActionLabel="Create Schedule"
                  specSection="Spec Section 10 & 21.2 (Schedules & BullMQ)"
                  onActionClick={() => showToast('Schedule creator launched.', 'info')}
                />
              }
            />
            <Route
              path="/pipelines/anomalies"
              element={
                <PipelineEmptyView
                  title="Anomaly & Quarantine Queue"
                  subtitle="System Spec Section 23 • Dead-letter storage, schema violations & crawler failures"
                  category="Fault Tolerance"
                  icon={AlertOctagon}
                  description="Unresolvable domains, dead URLs, HTTP 504 timeouts, and suspicious statistical deviations are quarantined here before affecting the published dataset."
                  suggestedActionLabel="Review Quarantine Rules"
                  specSection="Spec Section 11.2 (Failed Jobs & Retries)"
                  onActionClick={() => showToast('Quarantine filters applied.', 'info')}
                />
              }
            />

            {/* Other Core Routes */}
            <Route path="/review" element={<ReviewQueueView currentRole={currentRole} onActionFeedback={(msg) => showToast(msg, 'info')} />} />
            <Route path="/approved" element={<ApprovedSchoolsView />} />
            <Route path="/recrawl" element={<RecrawlQueueView />} />
            <Route path="/published" element={<PublishedDataView currentRole={currentRole} onFeedback={(msg) => showToast(msg, 'info')} />} />
            <Route path="/ranking" element={<SourceRankingView currentRole={currentRole} onFeedback={(msg) => showToast(msg, 'info')} />} />
            <Route path="/prompts" element={<PromptStudioView currentRole={currentRole} onFeedback={(msg) => showToast(msg, 'info')} />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* AI Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setCopilotOpen(false)}
        currentRole={currentRole}
      />
    </div>
  );
}

export default App;
