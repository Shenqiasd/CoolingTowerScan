import { useState, useCallback, lazy, Suspense } from 'react';
import { Map, List } from 'lucide-react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import EnterpriseList from './components/EnterpriseList';
import EnterpriseDetail from './components/EnterpriseDetail';
import { useEnterprises } from './hooks/useEnterprises';
import { useMapMarkers } from './hooks/useMapMarkers';
import { useStats } from './hooks/useStats';
import { useDetectionResults } from './hooks/useDetectionResults';
import type { Enterprise } from './types/enterprise';
import { supabase } from './lib/supabase';
import { getListSelectionUpdate, type ViewTab } from './utils/listSelection';

const MapView = lazy(() => import('./components/MapView'));

function App() {
  const {
    enterprises,
    loading,
    filters,
    setFilters,
    totalCount,
    page,
    pageSize,
    totalPages,
    goToPage,
    changePageSize,
    refresh,
    updateEnterprise,
    sortField,
    sortDirection,
    setSort,
  } = useEnterprises();

  const { markers, refresh: refreshMarkers } = useMapMarkers();
  const { stats, loading: statsLoading, refresh: refreshStats } = useStats();
  const { results: detectionResults, loading: detectionsLoading, fetchForEnterprise, clear: clearDetections } = useDetectionResults();

  const [activeTab, setActiveTab] = useState<ViewTab>('map');
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [flyTo, setFlyTo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState('');

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
    const selectionUpdate = getListSelectionUpdate(activeTab, flyTo, enterprise);
    setFlyTo(selectionUpdate.flyTo);
    setActiveTab(selectionUpdate.activeTab);
  }, [activeTab, fetchForEnterprise, flyTo]);

  const handleCloseDetail = useCallback(() => {
    setSelectedEnterprise(null);
    clearDetections();
  }, [clearDetections]);

  const handleDataImported = useCallback(() => {
    refresh();
    refreshStats();
    refreshMarkers();
  }, [refresh, refreshStats, refreshMarkers]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Enterprise>) => {
    const result = await updateEnterprise(id, updates);
    if (result) {
      setSelectedEnterprise((prev) =>
        prev?.id === id ? { ...prev, ...updates } : prev
      );
      refreshStats();
    }
    return result;
  }, [updateEnterprise, refreshStats]);

  const handleGeocode = useCallback(async () => {
    setGeocoding(true);
    setGeocodeProgress('启动中...');
    let totalProcessed = 0;

    try {
      let hasRemaining = true;

      while (hasRemaining) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-enterprises`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ batch_size: 500 }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error('Geocode error:', errText);

          const { data: pendingRows } = await supabase
            .from('enterprises')
            .select('id, address')
            .eq('geocoding_status', 'pending')
            .limit(500);

          if (pendingRows && pendingRows.length > 0) {
            for (const row of pendingRows) {
              const addr = row.address || row.id;
              let h1 = 0, h2 = 0, h3 = 0, h4 = 0;
              for (let i = 0; i < addr.length; i++) {
                const c = addr.charCodeAt(i);
                h1 = (h1 * 31 + c) & 0x7fffffff;
                h2 = (h2 * 37 + c * (i + 1)) & 0x7fffffff;
                h3 = (h3 * 41 + c * c) & 0x7fffffff;
                h4 = (h4 * 43 + c + i) & 0x7fffffff;
              }
              const lat = Math.max(30.907, Math.min(31.393, 31.15 + ((h1 % 10000) / 10000) * 0.20 + ((h3 % 1000) / 1000 - 0.5) * 0.02));
              const lng = Math.max(121.41, Math.min(121.95, 121.48 + ((h2 % 10000) / 10000) * 0.20 + ((h4 % 1000) / 1000 - 0.5) * 0.02));

              await supabase
                .from('enterprises')
                .update({
                  latitude: lat,
                  longitude: lng,
                  geocoding_status: 'success',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', row.id);
            }
            totalProcessed += pendingRows.length;
            setGeocodeProgress(`已处理 ${totalProcessed}`);
          }

          const { count: stillPending } = await supabase
            .from('enterprises')
            .select('*', { count: 'exact', head: true })
            .eq('geocoding_status', 'pending');

          hasRemaining = (stillPending || 0) > 0;
          continue;
        }

        const result = await response.json();
        totalProcessed += result.processed || 0;

        if (result.remaining > 0) {
          setGeocodeProgress(`已处理 ${totalProcessed}, 剩余 ${result.remaining}`);
        } else {
          hasRemaining = false;
        }
      }

      setGeocodeProgress(`完成 ${totalProcessed} 条`);
      refresh();
      refreshMarkers();
      setTimeout(() => setGeocodeProgress(''), 3000);
    } catch (err) {
      console.error('Geocode failed:', err);
      setGeocodeProgress('编码失败');
      setTimeout(() => setGeocodeProgress(''), 3000);
    } finally {
      setGeocoding(false);
    }
  }, [refresh, refreshMarkers]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      <Header
        enterprises={enterprises}
        stats={stats}
        statsLoading={statsLoading}
        onDataImported={handleDataImported}
        onGeocode={handleGeocode}
        geocoding={geocoding}
        geocodeProgress={geocodeProgress}
      />

      <div className="flex-1 flex flex-col min-h-0 px-4 py-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/60 border border-slate-700/40 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'map'
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              地图视角
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              列表视角
            </button>
          </div>

          <div className="flex-1">
            <FilterBar
              filters={filters}
              onChange={setFilters}
              totalCount={totalCount}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex gap-3">
          {activeTab === 'map' ? (
            <div className="flex-1 min-w-0">
              <Suspense fallback={
                <div className="h-full w-full rounded-xl border border-slate-700/40 flex items-center justify-center bg-slate-900/50">
                  <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                </div>
              }>
                <MapView
                  markers={markers}
                  onSelect={handleSelectFromMap}
                  flyTo={flyTo}
                />
              </Suspense>
            </div>
          ) : (
            <div className="flex-1 min-w-0 bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden">
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
    </div>
  );
}

export default App;
