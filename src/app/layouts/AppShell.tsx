import { useState, useCallback, useRef, lazy, Suspense, type SetStateAction } from 'react';
import { Map, List, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapScreenshot from '../../components/screenshot';
import type { ScreenshotResult } from '../../components/screenshot';
import Header from '../../components/Header';
import FilterBar from '../../components/FilterBar';
import EnterpriseList from '../../components/EnterpriseList';
import EnterpriseDetail from '../../components/EnterpriseDetail';
import LifecycleSidebar from '../../components/LifecycleSidebar';
import type { SidebarView } from '../../components/LifecycleSidebar';
import DetectionPanel from '../../components/DetectionPanel';
import ReportModal from '../../components/report/ReportModal';
import ProjectDashboard from '../../components/ProjectDashboard';
import { useEnterprises } from '../../hooks/useEnterprises';
import { useMapMarkers } from '../../hooks/useMapMarkers';
import { useStats } from '../../hooks/useStats';
import { useDetectionResults } from '../../hooks/useDetectionResults';
import { useProjects } from '../../hooks/useProjects';
import { useActiveScanTask } from '../../hooks/useActiveScanTask';
import CandidateDetailPage from '../../pages/candidates/CandidateDetailPage';
import CandidateListPage from '../../pages/candidates/CandidateListPage';
import LeadDetailPage from '../../pages/leads/LeadDetailPage';
import LeadListPage from '../../pages/leads/LeadListPage';
import ProjectDetailPage from '../../pages/projects/ProjectDetailPage';
import type { Enterprise } from '../../types/enterprise';
import type { PipelineStep, ScanSession, ScanDetection } from '../../types/pipeline';
import { INITIAL_SCAN_SESSION } from '../../types/pipeline';
import type { SopPhase } from '../../types/project';
import { SOP_PHASES } from '../../types/project';
import { supabase } from '../../lib/supabase';
import { importCsvFile } from '../../utils/csvImporter';
import { importDetectionCsv } from '../../utils/detectionImporter';
import * as XLSX from 'xlsx';
import { getListSelectionUpdate, type ViewTab } from '../../utils/listSelection';
import { applyScreenshotsReady } from '../../utils/scanSession';
import TaskStatusBanner from '../../components/discovery/TaskStatusBanner';
import RecentTaskList from '../../components/discovery/RecentTaskList';

const MapView = lazy(() => import('../../components/MapView'));

const DISCOVERY_PATHS: Record<PipelineStep, string> = {
  screenshot: '/discovery/screenshot',
  detection: '/discovery/detection',
  results: '/discovery/results',
};

const QUALIFICATION_PATHS = {
  candidates: '/candidates',
  leads: '/leads',
} as const;

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

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeView = getSidebarView(location.pathname);
  const activeStep = getPipelineStep(location.pathname);
  const isDashboard = activeView === 'dashboard';
  const isQualificationView = activeView === 'candidates' || activeView === 'leads';
  const isProjectDetailView = location.pathname.startsWith('/projects/');

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
    phaseFilter,
    setPhaseFilter,
  } = useProjects();

  const [resultView, setResultView] = useState<ViewTab>('list');
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [flyTo, setFlyTo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showReport, setShowReport] = useState(false);

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
      navigate('/projects');
      return;
    }

    if (view === 'candidates' || view === 'leads') {
      navigate(QUALIFICATION_PATHS[view]);
      return;
    }

    navigate(DISCOVERY_PATHS[view]);
  }, [navigate]);

  const handleStepChange = useCallback((step: PipelineStep) => {
    navigate(DISCOVERY_PATHS[step]);
  }, [navigate]);

  const handleCreateProjectFromEnterprise = useCallback(() => {
    navigate('/leads');
  }, [navigate]);

  return (
    <div className="h-screen flex bg-slate-950 text-white overflow-hidden">
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
        {isDashboard ? (
          isProjectDetailView ? (
            <ProjectDetailPage />
          ) : (
            <ProjectDashboard
              projects={projects}
              loading={projectsLoading}
              phaseFilter={phaseFilter}
              onPhaseFilter={setPhaseFilter}
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
                <TaskStatusBanner task={session.task} meta={taskMeta} />

                {activeStep === 'screenshot' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <RecentTaskList
                      tasks={recentTasks}
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
