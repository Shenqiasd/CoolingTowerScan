import { useState, useCallback, useRef, lazy, Suspense, useEffect, type FormEvent, type SetStateAction } from 'react';
import { Map, List, Loader2, Lock, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapScreenshot from '../../components/screenshot';
import type { ScreenshotResult } from '../../components/screenshot';
import Header from '../../components/Header';
import FilterBar from '../../components/FilterBar';
import EnterpriseList from '../../components/EnterpriseList';
import EnterpriseDetail from '../../components/EnterpriseDetail';
import ResultsOverviewStrip from '../../components/results/ResultsOverviewStrip';
import LifecycleSidebar from '../../components/LifecycleSidebar';
import type { SidebarView } from '../../components/LifecycleSidebar';
import DetectionPanel from '../../components/DetectionPanel';
import ReportModal from '../../components/report/ReportModal';
import ProjectDashboard from '../../components/ProjectDashboard';
import SurveyWorkflowPage, { type SurveyProjectTarget } from '../../components/SurveyWorkflowPage';
import { useEnterprises } from '../../hooks/useEnterprises';
import { useMapMarkers } from '../../hooks/useMapMarkers';
import { useStats } from '../../hooks/useStats';
import { useDetectionResults } from '../../hooks/useDetectionResults';
import { useProjects } from '../../hooks/useProjects';
import { useActiveScanTask } from '../../hooks/useActiveScanTask';
import { loginWithPassword } from '../../api/auth';
import { ApiClientError, clearAppAuthToken, getStoredAppAuthToken, storeAppAuthToken } from '../../api/client';
import CandidateDetailPage from '../../pages/candidates/CandidateDetailPage';
import CandidateListPage from '../../pages/candidates/CandidateListPage';
import LeadDetailPage from '../../pages/leads/LeadDetailPage';
import LeadListPage from '../../pages/leads/LeadListPage';
import ProjectDetailPage from '../../pages/projects/ProjectDetailPage';
import type { Enterprise } from '../../types/enterprise';
import type { PipelineStep, ScanSession, ScanDetection } from '../../types/pipeline';
import { INITIAL_SCAN_SESSION } from '../../types/pipeline';
import type { SopPhase, SurveyWorkflowView } from '../../types/project';
import { SOP_PHASES, SURVEY_WORKFLOW_VIEWS } from '../../types/project';
import { supabase } from '../../lib/supabase';
import { importCsvFile } from '../../utils/csvImporter';
import { importDetectionCsv } from '../../utils/detectionImporter';
import * as XLSX from 'xlsx';
import { getListSelectionUpdate, type ViewTab } from '../../utils/listSelection';
import { applyScreenshotsReady } from '../../utils/scanSession';
import TaskStatusBanner from '../../components/discovery/TaskStatusBanner';
import RecentTaskList from '../../components/discovery/RecentTaskList';
import {
  getInitialTaskBannerCollapsed,
  TASK_BANNER_PREFERENCE_KEY,
} from '../../components/discovery/taskBannerPreference';
import {
  getInitialRecentTaskListCollapsed,
  RECENT_TASK_LIST_PREFERENCE_KEY,
} from '../../components/discovery/recentTaskListPreference';

const MapView = lazy(() => import('../../components/MapView'));

function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState('user');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await loginWithPassword(username, password);
      storeAppAuthToken(result.token, result.expiresAt);
      onAuthenticated();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'APP_AUTH_INVALID_CREDENTIALS') {
        setError('账号或密码不正确');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('登录失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold">空调调研智能体平台</h1>
            <p className="mt-1 text-xs text-slate-500">登录后进入线索发现与踏勘调研工作台</p>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs text-slate-400">账号</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-500/60"
            autoComplete="username"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs text-slate-400">密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-emerald-500/60"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          登录
        </button>
      </form>
    </div>
  );
}

const DISCOVERY_PATHS: Record<PipelineStep, string> = {
  screenshot: '/discovery/screenshot',
  detection: '/discovery/detection',
  results: '/discovery/results',
};

const QUALIFICATION_PATHS = {
  candidates: '/candidates',
  leads: '/leads',
} as const;

function isSopPhase(value: string | null): value is SopPhase {
  return Boolean(value && SOP_PHASES.includes(value as SopPhase));
}

function getProjectPhaseFromSearch(search: string): SopPhase | '' {
  const value = new URLSearchParams(search).get('phase');
  return isSopPhase(value) ? value : '';
}

function getSurveyWorkflowFromSearch(search: string): SurveyWorkflowView {
  const value = new URLSearchParams(search).get('module');
  return SURVEY_WORKFLOW_VIEWS.includes(value as SurveyWorkflowView)
    ? value as SurveyWorkflowView
    : 'overview';
}

function buildProjectModulePath(projectId: string, target?: SurveyProjectTarget) {
  const params = new URLSearchParams();
  if (target?.surveyTab) {
    params.set('surveyTab', target.surveyTab);
  }
  if (target?.section) {
    params.set('section', target.section);
  }

  const query = params.toString();
  return query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`;
}

function getSidebarView(pathname: string): SidebarView {
  if (pathname.startsWith('/projects')) {
    return 'dashboard';
  }

  if (pathname.startsWith('/candidates')) {
    return 'candidates';
  }

  if (pathname.startsWith('/leads')) {
    return 'leads';
  }

  if (pathname === '/discovery/screenshot') {
    return 'screenshot';
  }

  if (pathname === '/discovery/results') {
    return 'results';
  }

  return 'detection';
}

function getPipelineStep(pathname: string): PipelineStep {
  if (pathname === '/discovery/screenshot') {
    return 'screenshot';
  }

  if (pathname === '/discovery/results') {
    return 'results';
  }

  return 'detection';
}

function readTaskBannerPreference(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(TASK_BANNER_PREFERENCE_KEY);
}

function readRecentTaskListPreference(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(RECENT_TASK_LIST_PREFERENCE_KEY);
}

function AuthenticatedAppShell({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeView = getSidebarView(location.pathname);
  const activeStep = getPipelineStep(location.pathname);
  const isDashboard = activeView === 'dashboard';
  const isQualificationView = activeView === 'candidates' || activeView === 'leads';
  const isProjectDetailView = location.pathname.startsWith('/projects/');
  const requestedProjectPhase = isDashboard && !isProjectDetailView
    ? getProjectPhaseFromSearch(location.search)
    : '';

  const {
    session,
    setSession,
    recentTasks,
    selectTask,
    refreshRecentTasks,
    taskMeta,
  } = useActiveScanTask();

  const {
    enterprises, loading, filters, setFilters, totalCount,
    page, pageSize, totalPages, goToPage, changePageSize,
    refresh, updateEnterprise, sortField, sortDirection, setSort,
  } = useEnterprises();
  const { markers, refresh: refreshMarkers } = useMapMarkers();
  const { stats, loading: statsLoading, refresh: refreshStats } = useStats();
  const {
    results: detectionResults,
    loading: detectionsLoading,
    fetchForEnterprise,
    clear: clearDetections,
  } = useDetectionResults();
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    phaseFilter,
    setPhaseFilter,
    initializeSurveyProject,
  } = useProjects();

  const [resultView, setResultView] = useState<ViewTab>('list');
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [flyTo, setFlyTo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [isTaskBannerCollapsed, setIsTaskBannerCollapsed] = useState(() => getInitialTaskBannerCollapsed(
    activeStep,
    readTaskBannerPreference(),
  ));
  const [isRecentTaskListCollapsed, setIsRecentTaskListCollapsed] = useState(() => getInitialRecentTaskListCollapsed(
    activeStep,
    readRecentTaskListPreference(),
  ));

  const enterpriseFileRef = useRef<HTMLInputElement>(null);
  const detectionFileRef = useRef<HTMLInputElement>(null);

  const projectCounts = SOP_PHASES.reduce((acc, phase) => {
    acc[phase] = projects.filter((project) => project.current_phase === phase).length;
    return acc;
  }, {} as Record<SopPhase, number>);

  const handleDataImported = useCallback(() => {
    refresh();
    refreshStats();
    refreshMarkers();
    void refreshRecentTasks(session.sessionId ?? null);
  }, [refresh, refreshMarkers, refreshRecentTasks, refreshStats, session.sessionId]);

  const handleSelectFromMap = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('enterprises')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      setSelectedEnterprise(data as Enterprise);
      fetchForEnterprise(id);
    }
  }, [fetchForEnterprise]);

  const handleSelectFromList = useCallback((enterprise: Enterprise) => {
    setSelectedEnterprise(enterprise);
    fetchForEnterprise(enterprise.id);
    const update = getListSelectionUpdate(resultView, flyTo, enterprise);
    setFlyTo(update.flyTo);
    setResultView(update.activeTab);
  }, [fetchForEnterprise, flyTo, resultView]);

  const handleCloseDetail = useCallback(() => {
    setSelectedEnterprise(null);
    clearDetections();
  }, [clearDetections]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Enterprise>): Promise<boolean> => {
    await updateEnterprise(id, updates);
    if (selectedEnterprise?.id === id) {
      setSelectedEnterprise((prev) => (prev ? { ...prev, ...updates } : null));
    }
    return true;
  }, [selectedEnterprise?.id, updateEnterprise]);

  const handleDetectionsUpdate = useCallback((update: SetStateAction<ScanDetection[]>) => {
    setSession((prev) => ({
      ...prev,
      detections: typeof update === 'function' ? update(prev.detections) : update,
    }));
  }, []);

  const handleDetectionStatusChange = useCallback((status: 'detecting' | 'complete' | 'idle') => {
    setSession((prev) => ({ ...prev, status }));
    if (status === 'complete') {
      handleDataImported();
    }
  }, [handleDataImported]);

  const handleScreenshotsReady = useCallback((screenshots: ScreenshotResult[]) => {
    setSession((prev) => applyScreenshotsReady(prev, screenshots));
    void refreshRecentTasks(screenshots[0]?.sessionId ?? null);
    navigate(DISCOVERY_PATHS.detection);
  }, [navigate, refreshRecentTasks, setSession]);

  const handleFileImport = useCallback(async (
    file: File,
    importFn: (rows: Record<string, string>[]) => Promise<{ imported: number }>,
  ) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let rows: Record<string, string>[] = [];

    if (ext === 'csv') {
      const text = await file.text();
      rows = text.split('\n').filter(Boolean).map((line) => {
        const values = line.split(',');
        return Object.fromEntries(values.map((value, index) => [String(index), value]));
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(worksheet);
    }

    if (rows.length > 0) {
      await importFn(rows);
      handleDataImported();
    }
  }, [handleDataImported]);

  const handleViewChange = useCallback((view: SidebarView) => {
    if (view === 'dashboard') {
      setPhaseFilter('');
      navigate('/projects');
      return;
    }

    if (view === 'candidates' || view === 'leads') {
      navigate(QUALIFICATION_PATHS[view]);
      return;
    }

    navigate(DISCOVERY_PATHS[view]);
  }, [navigate, setPhaseFilter]);

  const handleProjectPhaseSelect = useCallback((phase: SopPhase) => {
    setPhaseFilter(phase);
    navigate(`/projects?phase=${phase}`);
  }, [navigate, setPhaseFilter]);

  const handleSurveyWorkflowSelect = useCallback((view: SurveyWorkflowView) => {
    setPhaseFilter('survey');
    navigate(`/projects?phase=survey&module=${view}`);
  }, [navigate, setPhaseFilter]);

  const handleProjectPhaseFilter = useCallback((phase: SopPhase | '') => {
    setPhaseFilter(phase);
    navigate(phase ? `/projects?phase=${phase}` : '/projects');
  }, [navigate, setPhaseFilter]);

  const handleStepChange = useCallback((step: PipelineStep) => {
    navigate(DISCOVERY_PATHS[step]);
  }, [navigate]);

  const handleCreateProjectFromEnterprise = useCallback(async () => {
    const project = await initializeSurveyProject();
    navigate(`/projects/${project.id}`);
  }, [initializeSurveyProject, navigate]);

  useEffect(() => {
    setIsTaskBannerCollapsed(getInitialTaskBannerCollapsed(
      activeStep,
      readTaskBannerPreference(),
    ));
    setIsRecentTaskListCollapsed(getInitialRecentTaskListCollapsed(
      activeStep,
      readRecentTaskListPreference(),
    ));
  }, [activeStep]);

  useEffect(() => {
    if (!isDashboard || isProjectDetailView || requestedProjectPhase === phaseFilter) {
      return;
    }

    setPhaseFilter(requestedProjectPhase);
  }, [isDashboard, isProjectDetailView, phaseFilter, requestedProjectPhase, setPhaseFilter]);

  const handleTaskBannerToggle = useCallback(() => {
    setIsTaskBannerCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(TASK_BANNER_PREFERENCE_KEY, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  const handleRecentTaskListToggle = useCallback(() => {
    setIsRecentTaskListCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(RECENT_TASK_LIST_PREFERENCE_KEY, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  return (
    <div className="relative h-screen flex bg-slate-950 text-white overflow-hidden">
      <input
        ref={enterpriseFileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFileImport(file, (rows) => importCsvFile(rows as never));
          }
          event.target.value = '';
        }}
      />
      <input
        ref={detectionFileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFileImport(file, (rows) => importDetectionCsv(rows as never));
          }
          event.target.value = '';
        }}
      />

      <LifecycleSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        activeProjectPhase={isDashboard ? phaseFilter : ''}
        onProjectPhaseSelect={handleProjectPhaseSelect}
        activeSurveyWorkflow={isDashboard && phaseFilter === 'survey' ? getSurveyWorkflowFromSearch(location.search) : null}
        onSurveyWorkflowSelect={handleSurveyWorkflowSelect}
        activeStep={activeStep}
        onStepChange={handleStepChange}
        session={session}
        stats={stats}
        projectCounts={projectCounts}
        onImportEnterprise={() => enterpriseFileRef.current?.click()}
        onImportDetection={() => detectionFileRef.current?.click()}
        onExport={() => {}}
        onReport={() => setShowReport(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={onLogout}
          className="absolute right-4 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-[11px] text-slate-300 shadow-lg transition-colors hover:border-slate-500 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出
        </button>
        {isDashboard ? (
          isProjectDetailView ? (
            <ProjectDetailPage />
          ) : phaseFilter === 'survey' ? (
            <SurveyWorkflowPage
              projects={projects}
              loading={projectsLoading}
              error={projectsError}
              activeModule={getSurveyWorkflowFromSearch(location.search)}
              onInitializeProject={handleCreateProjectFromEnterprise}
              onSelectProject={(project) => {
                navigate(`/projects/${project.id}`);
              }}
              onOpenProjectModule={(project, target) => {
                navigate(buildProjectModulePath(project.id, target));
              }}
            />
          ) : (
            <ProjectDashboard
              projects={projects}
              loading={projectsLoading}
              error={projectsError}
              phaseFilter={phaseFilter}
              surveyWorkflowView={null}
              onPhaseFilter={handleProjectPhaseFilter}
              onCreateFromEnterprise={handleCreateProjectFromEnterprise}
              onSelectProject={(project) => {
                navigate(`/projects/${project.id}`);
              }}
            />
          )
        ) : (
          <>
            <div className="border-b border-slate-800 px-4 py-3">
              <Header stats={stats} statsLoading={statsLoading} />
            </div>

            {isQualificationView ? (
              activeView === 'candidates'
                ? location.pathname === '/candidates'
                  ? <CandidateListPage />
                  : <CandidateDetailPage />
                : location.pathname === '/leads'
                  ? <LeadListPage />
                  : <LeadDetailPage />
            ) : (
              <>
                <TaskStatusBanner
                  task={session.task}
                  meta={taskMeta}
                  collapsed={activeStep === 'screenshot' ? isTaskBannerCollapsed : false}
                  onToggleCollapse={activeStep === 'screenshot' ? handleTaskBannerToggle : undefined}
                />

                {activeStep === 'screenshot' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <RecentTaskList
                      tasks={recentTasks}
                      collapsed={isRecentTaskListCollapsed}
                      onToggleCollapse={handleRecentTaskListToggle}
                      onSelect={(taskId) => {
                        void selectTask(taskId).then((restored) => {
                          if (restored?.task) {
                            navigate('/discovery/detection');
                          }
                        });
                      }}
                    />
                    <div className="flex-1 min-h-0">
                      <MapScreenshot onScreenshotsComplete={handleScreenshotsReady} />
                    </div>
                  </div>
                )}

                {activeStep === 'detection' && (
                  <DetectionPanel
                    screenshots={session.screenshots}
                    detections={session.detections}
                    onDetectionsUpdate={handleDetectionsUpdate}
                    onStatusChange={handleDetectionStatusChange}
                    onDataImported={handleDataImported}
                  />
                )}

                {activeStep === 'results' && (
                  <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <ResultsOverviewStrip stats={stats} />
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800">
                        <button
                          onClick={() => setResultView('list')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                            resultView === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" /> 列表
                        </button>
                        <button
                          onClick={() => setResultView('map')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                            resultView === 'map' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Map className="w-3.5 h-3.5" /> 地图
                        </button>
                        <div className="flex-1" />
                        <FilterBar filters={filters} onChange={setFilters} totalCount={totalCount} />
                      </div>

                      <div className="flex-1 overflow-hidden">
                        {resultView === 'map' ? (
                          <Suspense
                            fallback={
                              <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                              </div>
                            }
                          >
                            <MapView
                              markers={markers}
                              flyTo={flyTo}
                              onSelect={handleSelectFromMap}
                            />
                          </Suspense>
                        ) : (
                          <EnterpriseList
                            enterprises={enterprises}
                            loading={loading}
                            onSelect={handleSelectFromList}
                            selectedId={selectedEnterprise?.id ?? null}
                            page={page}
                            pageSize={pageSize}
                            totalPages={totalPages}
                            totalCount={totalCount}
                            onPageChange={goToPage}
                            onPageSizeChange={changePageSize}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={setSort}
                          />
                        )}
                      </div>

                      {selectedEnterprise && (
                        <EnterpriseDetail
                          enterprise={selectedEnterprise}
                          detectionResults={detectionResults}
                          detectionsLoading={detectionsLoading}
                          onClose={handleCloseDetail}
                          onUpdate={handleUpdate}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showReport && (
        <ReportModal
          stats={stats}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

export default function AppShell() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getStoredAppAuthToken()));

  const handleLogout = useCallback(() => {
    clearAppAuthToken();
    setIsAuthenticated(false);
  }, []);

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return <AuthenticatedAppShell onLogout={handleLogout} />;
}
