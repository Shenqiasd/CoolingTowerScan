import { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { Map, List, Loader2 } from 'lucide-react';
import MapScreenshot from './components/screenshot';
import type { ScreenshotResult } from './components/screenshot';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import EnterpriseList from './components/EnterpriseList';
import EnterpriseDetail from './components/EnterpriseDetail';
import PipelineSidebar from './components/PipelineSidebar';
import DetectionPanel from './components/DetectionPanel';
import ReportModal from './components/report/ReportModal';
import { useEnterprises } from './hooks/useEnterprises';
import { useMapMarkers } from './hooks/useMapMarkers';
import { useStats } from './hooks/useStats';
import { useDetectionResults } from './hooks/useDetectionResults';
import type { Enterprise } from './types/enterprise';
import type { PipelineStep, ScanSession, ScanDetection } from './types/pipeline';
import { INITIAL_SCAN_SESSION } from './types/pipeline';
import { supabase } from './lib/supabase';
import { importCsvFile } from './utils/csvImporter';
import { importDetectionCsv } from './utils/detectionImporter';
import * as XLSX from 'xlsx';
import { getListSelectionUpdate, type ViewTab } from './utils/listSelection';

const MapView = lazy(() => import('./components/MapView'));

function App() {
  // Pipeline state
  const [activeStep, setActiveStep] = useState<PipelineStep>('results');
  const [session, setSession] = useState<ScanSession>(INITIAL_SCAN_SESSION);

  // Data hooks
  const {
    enterprises, loading, filters, setFilters, totalCount,
    page, pageSize, totalPages, goToPage, changePageSize,
    refresh, updateEnterprise, sortField, sortDirection, setSort,
  } = useEnterprises();
  const { markers, refresh: refreshMarkers } = useMapMarkers();
  const { stats, loading: statsLoading, refresh: refreshStats } = useStats();
  const { results: detectionResults, loading: detectionsLoading, fetchForEnterprise, clear: clearDetections } = useDetectionResults();

  // UI state
  const [resultView, setResultView] = useState<ViewTab>('list');
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [flyTo, setFlyTo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showReport, setShowReport] = useState(false);

  // File input refs for sidebar data management
  const enterpriseFileRef = useRef<HTMLInputElement>(null);
  const detectionFileRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleDataImported = useCallback(() => {
    refresh();
    refreshStats();
    refreshMarkers();
  }, [refresh, refreshStats, refreshMarkers]);

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

  const handleUpdate = useCallback(async (id: string, updates: Partial<Enterprise>) => {
    const { error } = await supabase
      .from('enterprises')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return false;
    updateEnterprise(id, updates);
    setSelectedEnterprise(prev => prev?.id === id ? { ...prev, ...updates } as Enterprise : prev);
    return true;
  }, [updateEnterprise]);

  // Screenshot complete → move to detection step
  const handleScreenshotsComplete = useCallback((results: ScreenshotResult[]) => {
    setSession(prev => ({
      ...prev,
      screenshots: [...prev.screenshots, ...results],
      status: 'idle',
    }));
    setActiveStep('detection');
  }, []);

  // Detection updates
  const handleDetectionsUpdate = useCallback((detections: ScanDetection[]) => {
    setSession(prev => ({ ...prev, detections }));
  }, []);

  const handleDetectionStatusChange = useCallback((status: 'detecting' | 'complete' | 'idle') => {
    setSession(prev => ({ ...prev, status }));
    if (status === 'complete') {
      handleDataImported();
    }
  }, [handleDataImported]);

  // Data management (sidebar)
  const handleImportEnterprise = useCallback(() => {
    enterpriseFileRef.current?.click();
  }, []);

  const handleEnterpriseFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importCsvFile(file);
    handleDataImported();
    e.target.value = '';
  }, [handleDataImported]);

  const handleImportDetection = useCallback(() => {
    detectionFileRef.current?.click();
  }, []);

  const handleDetectionFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importDetectionCsv(file);
    handleDataImported();
    e.target.value = '';
  }, [handleDataImported]);

  const handleExport = useCallback(async () => {
    const { data } = await supabase
      .from('enterprises')
      .select('*')
      .order('composite_score', { ascending: false });
    if (!data || data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '企业数据');
    XLSX.writeFile(wb, `冷却塔识别数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, []);

  return (
    <div className="h-screen flex bg-slate-950 text-white overflow-hidden">
      {/* Hidden file inputs */}
      <input ref={enterpriseFileRef} type="file" accept=".csv" onChange={handleEnterpriseFileChange} className="hidden" />
      <input ref={detectionFileRef} type="file" accept=".csv" onChange={handleDetectionFileChange} className="hidden" />

      {/* Left Sidebar */}
      <PipelineSidebar
        activeStep={activeStep}
        onStepChange={setActiveStep}
        session={session}
        stats={stats}
        onImportEnterprise={handleImportEnterprise}
        onImportDetection={handleImportDetection}
        onExport={handleExport}
        onReport={() => setShowReport(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Step 1: Screenshot */}
        {activeStep === 'screenshot' && (
          <MapScreenshot onScreenshotsComplete={handleScreenshotsComplete} />
        )}

        {/* Step 2: Detection */}
        {activeStep === 'detection' && (
          <DetectionPanel
            screenshots={session.screenshots}
            detections={session.detections}
            onDetectionsUpdate={handleDetectionsUpdate}
            onStatusChange={handleDetectionStatusChange}
          />
        )}

        {/* Step 3: Results */}
        {activeStep === 'results' && (
          <>
            {/* KPI + Filters */}
            <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-3 border-b border-slate-800/50">
              <Header stats={stats} statsLoading={statsLoading} />
              <div className="flex items-center gap-3">
                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  totalCount={totalCount}
                />
                {/* Sub-view toggle */}
                <div className="flex bg-slate-800/60 border border-slate-700/40 rounded-lg p-0.5 gap-0.5 ml-auto flex-shrink-0">
                  <button
                    onClick={() => setResultView('list')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      resultView === 'list'
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    列表
                  </button>
                  <button
                    onClick={() => setResultView('map')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      resultView === 'map'
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    地图
                  </button>
                </div>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 min-w-0 overflow-hidden">
                {resultView === 'map' ? (
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                  }>
                    <MapView
                      markers={markers}
                      onSelect={handleSelectFromMap}
                      flyTo={flyTo}
                    />
                  </Suspense>
                ) : (
                  <div className="h-full overflow-auto p-4">
                    <EnterpriseList
                      enterprises={enterprises}
                      selectedId={selectedEnterprise?.id || null}
                      onSelect={handleSelectFromList}
                      loading={loading}
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
                  </div>
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
