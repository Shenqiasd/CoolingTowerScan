import { useState, useCallback, useRef, lazy, Suspense, useEffect, type SetStateAction } from 'react';
import { Map, List, Loader2 } from 'lucide-react';
import MapScreenshot from './components/screenshot';
import type { ScreenshotResult } from './components/screenshot';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import EnterpriseList from './components/EnterpriseList';
import EnterpriseDetail from './components/EnterpriseDetail';
import LifecycleSidebar from './components/LifecycleSidebar';
import type { SidebarView } from './components/LifecycleSidebar';
import DetectionPanel from './components/DetectionPanel';
import ReportModal from './components/report/ReportModal';
import ProjectDashboard from './components/ProjectDashboard';
import { useEnterprises } from './hooks/useEnterprises';
import { useMapMarkers } from './hooks/useMapMarkers';
import { useStats } from './hooks/useStats';
import { useDetectionResults } from './hooks/useDetectionResults';
import { useProjects } from './hooks/useProjects';
import type { Enterprise } from './types/enterprise';
import type { PipelineStep, ScanSession, ScanDetection } from './types/pipeline';
import { INITIAL_SCAN_SESSION } from './types/pipeline';
import type { SopPhase } from './types/project';
import { SOP_PHASES } from './types/project';
import { supabase } from './lib/supabase';
import { importCsvFile } from './utils/csvImporter';
import { importDetectionCsv } from './utils/detectionImporter';
import * as XLSX from 'xlsx';
import { getListSelectionUpdate, type ViewTab } from './utils/listSelection';
import { applyScreenshotsReady } from './utils/scanSession';
import {
  buildRestoredScanSession,
  type PersistedDetectionRow,
  type PersistedScreenshotRow,
} from './utils/scanSessionPersistence';

const MapView = lazy(() => import('./components/MapView'));

const ACTIVE_SCAN_SESSION_KEY = 'active_scan_session_id';
const ACTIVE_SCAN_STEP_KEY = 'active_scan_step';
const ACTIVE_SCAN_VIEW_KEY = 'active_scan_view';

function isSidebarView(value: string | null): value is SidebarView {
  return value === 'dashboard' || value === 'screenshot' || value === 'detection' || value === 'results';
}

function isPipelineStep(value: string | null): value is PipelineStep {
  return value === 'screenshot' || value === 'detection' || value === 'results';
}

function App() {
  // Pipeline state
  const [activeStep, setActiveStep] = useState<PipelineStep>(() => {
    if (typeof window === 'undefined') {
      return 'results';
    }

    const stored = localStorage.getItem(ACTIVE_SCAN_STEP_KEY);
    return isPipelineStep(stored) ? stored : 'results';
  });
  const [session, setSession] = useState<ScanSession>(INITIAL_SCAN_SESSION);
  const [activeView, setActiveView] = useState<SidebarView>(() => {
    if (typeof window === 'undefined') {
      return 'dashboard';
    }

    const stored = localStorage.getItem(ACTIVE_SCAN_VIEW_KEY);
    return isSidebarView(stored) ? stored : 'dashboard';
  });

  // Data hooks
  const {
    enterprises, loading, filters, setFilters, totalCount,
    page, pageSize, totalPages, goToPage, changePageSize,
    refresh, updateEnterprise, sortField, sortDirection, setSort,
  } = useEnterprises();
  const { markers, refresh: refreshMarkers } = useMapMarkers();
  const { stats, loading: statsLoading, refresh: refreshStats } = useStats();
  const { results: detectionResults, loading: detectionsLoading, fetchForEnterprise, clear: clearDetections } = useDetectionResults();
  const {
    projects, loading: projectsLoading,
    phaseFilter, setPhaseFilter,
    refresh: refreshProjects,
    createFromEnterprise, updatePhase,
  } = useProjects();

  // UI state
  const [resultView, setResultView] = useState<ViewTab>('list');
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [flyTo, setFlyTo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showReport, setShowReport] = useState(false);

  // File input refs for sidebar data management
  const enterpriseFileRef = useRef<HTMLInputElement>(null);
  const detectionFileRef = useRef<HTMLInputElement>(null);

  // Project phase counts for sidebar
  const projectCounts = SOP_PHASES.reduce((acc, phase) => {
    acc[phase] = projects.filter((p) => p.current_phase === phase).length;
    return acc;
  }, {} as Record<SopPhase, number>);

  // --- Handlers ---

  const handleDataImported = useCallback(() => {
    refresh();
    refreshStats();
    refreshMarkers();
  }, [refresh, refreshStats, refreshMarkers]);

  useEffect(() => {
    let cancelled = false;

    const restoreScanSession = async () => {
      const sessionId = localStorage.getItem(ACTIVE_SCAN_SESSION_KEY);
      if (!sessionId) {
        return;
      }

      const { data: sessionRow, error: sessionError } = await supabase
        .from('scan_sessions')
        .select('id, mode')
        .eq('id', sessionId)
        .maybeSingle();
      if (sessionError || !sessionRow) {
        localStorage.removeItem(ACTIVE_SCAN_SESSION_KEY);
        return;
      }

      const { data: screenshotRows, error: screenshotError } = await supabase
        .from('scan_screenshots')
        .select(`
          id,
          session_id,
          enterprise_id,
          filename,
          storage_url,
          annotated_url,
          lng,
          lat,
          row_idx,
          col_idx,
          address_label,
          resolved_address,
          has_cooling_tower,
          tower_count,
          max_confidence,
          detection_status,
          review_status
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (screenshotError || !screenshotRows?.length) {
        localStorage.removeItem(ACTIVE_SCAN_SESSION_KEY);
        return;
      }

      const screenshotIds = screenshotRows.map((row) => row.id);
      let detectionRows: PersistedDetectionRow[] = [];
      if (screenshotIds.length > 0) {
        const { data, error } = await supabase
          .from('detection_results')
          .select('screenshot_id, confidence, class_name, bbox_x1, bbox_y1, bbox_x2, bbox_y2')
          .in('screenshot_id', screenshotIds)
          .order('detection_id', { ascending: true });
        if (!error && data) {
          detectionRows = data as PersistedDetectionRow[];
        }
      }

      const restored = buildRestoredScanSession({
        sessionId,
        mode: sessionRow.mode,
        screenshots: screenshotRows as PersistedScreenshotRow[],
        detectionRows,
      });

      if (cancelled || restored.screenshots.length === 0) {
        return;
      }

      setSession(restored);

      const storedView = localStorage.getItem(ACTIVE_SCAN_VIEW_KEY);
      const storedStep = localStorage.getItem(ACTIVE_SCAN_STEP_KEY);
      setActiveView(isSidebarView(storedView) ? storedView : 'detection');
      setActiveStep(isPipelineStep(storedStep) ? storedStep : 'detection');
    };

    void restoreScanSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session.sessionId) {
      localStorage.setItem(ACTIVE_SCAN_SESSION_KEY, session.sessionId);
      return;
    }

    localStorage.removeItem(ACTIVE_SCAN_SESSION_KEY);
  }, [session.sessionId]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_SCAN_VIEW_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_SCAN_STEP_KEY, activeStep);
  }, [activeStep]);

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
  }, [resultView, fetchForEnterprise, flyTo]);

  const handleCloseDetail = useCallback(() => {
    setSelectedEnterprise(null);
    clearDetections();
  }, [clearDetections]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Enterprise>): Promise<boolean> => {
    await updateEnterprise(id, updates);
    if (selectedEnterprise?.id === id) {
      setSelectedEnterprise((prev) => prev ? { ...prev, ...updates } : null);
    }
    return true;
  }, [updateEnterprise, selectedEnterprise]);

  const handleDetectionComplete = useCallback((results: ScanDetection[]) => {
    setSession((prev) => ({
      ...prev,
      detections: results,
      status: 'complete',
    }));
    handleDataImported();
  }, [handleDataImported]);

  const handleDetectionsUpdate = useCallback((update: SetStateAction<ScanDetection[]>) => {
    setSession((prev) => ({
      ...prev,
      detections: typeof update === 'function' ? update(prev.detections) : update,
    }));
  }, []);

  const handleDetectionStatusChange = useCallback((status: 'detecting' | 'complete' | 'idle') => {
    setSession((prev) => ({ ...prev, status }));
    if (status === 'complete') handleDataImported();
  }, [handleDataImported]);

  const handleScreenshotsReady = useCallback((screenshots: ScreenshotResult[]) => {
    setSession((prev) => applyScreenshotsReady(prev, screenshots));
    setActiveStep('detection');
    setActiveView('detection');
  }, []);

  // File import handlers
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
        return Object.fromEntries(values.map((v, i) => [String(i), v]));
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws);
    }

    if (rows.length > 0) {
      await importFn(rows);
      handleDataImported();
    }
  }, [handleDataImported]);

  const handleViewChange = useCallback((view: SidebarView) => {
    setActiveView(view);
    if (view !== 'dashboard') {
      setActiveStep(view as PipelineStep);
    }
  }, []);

  const handleCreateProjectFromEnterprise = useCallback(() => {
    // Switch to results view to let user pick an enterprise
    setActiveView('results');
    setActiveStep('results');
  }, []);

  const isDashboard = activeView === 'dashboard';

  return (
    <div className="h-screen flex bg-slate-950 text-white overflow-hidden">
      {/* Hidden file inputs */}
      <input ref={enterpriseFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileImport(f, (rows) => importCsvFile(rows as any));
          e.target.value = '';
        }}
      />
      <input ref={detectionFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileImport(f, (rows) => importDetectionCsv(rows as any));
          e.target.value = '';
        }}
      />

      {/* Lifecycle Sidebar */}
      <LifecycleSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        activeStep={activeStep}
        onStepChange={setActiveStep}
        session={session}
        stats={stats}
        projectCounts={projectCounts}
        onImportEnterprise={() => enterpriseFileRef.current?.click()}
        onImportDetection={() => detectionFileRef.current?.click()}
        onExport={() => {/* existing export logic */}}
        onReport={() => setShowReport(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isDashboard ? (
          <ProjectDashboard
            projects={projects}
            loading={projectsLoading}
            phaseFilter={phaseFilter}
            onPhaseFilter={setPhaseFilter}
            onCreateFromEnterprise={handleCreateProjectFromEnterprise}
            onSelectProject={(p) => {
              // Navigate to the project's current phase module
              if (p.current_phase === 'prospecting') {
                setActiveView('results');
                setActiveStep('results');
              }
            }}
          />
        ) : (
          <>
            {/* Header */}
            <Header
              stats={stats}
              statsLoading={statsLoading}
            />

            {/* Content based on active step */}
            {activeStep === 'screenshot' && (
              <MapScreenshot onScreenshotsComplete={handleScreenshotsReady} />
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
                {/* View toggle */}
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
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                        </div>
                      }>
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
      </div>

      {/* Report Modal */}
      {showReport && (
        <ReportModal
          stats={stats}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

export default App;
