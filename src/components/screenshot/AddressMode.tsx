import { useState, useRef, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import gcoord from 'gcoord';
import { Search, Play, StopCircle, Plus, Trash2, MapPin } from 'lucide-react';
import MapCanvas, { type MapCanvasHandle } from './MapCanvas';
import { runAddressCapture, estimateAddressGridCount, type CaptureResult } from './CaptureEngine';
import { searchLocations, type SearchResult } from '../../utils/locationSearch';

interface Props {
  token: string;
  onComplete: (results: CaptureResult[]) => void;
}

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

interface BatchAddress {
  text: string;
  resolvedAddress?: string;
  status: 'pending' | 'done' | 'error';
  lng?: number;
  lat?: number;
}

const CIRCLE_SOURCE = 'radius-circle';

function gcj02ToWgs84(location: string): [number, number] {
  const [lng, lat] = location.split(',').map(Number);
  const [wLng, wLat] = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
  return [wLng, wLat];
}

function resolveSearchCoordinates(result: SearchResult): [number, number] {
  if (result.coordinateSystem === 'gcj02') {
    return gcj02ToWgs84(result.location);
  }

  return result.location.split(',').map(Number) as [number, number];
}

function makeCircleGeoJSON(lng: number, lat: number, radiusM: number): GeoJSON.FeatureCollection {
  const points = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLng = (radiusM / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(angle);
    const dLat = (radiusM / 111320) * Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    ],
  };
}

function now(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export default function AddressMode({ token, onComplete }: Props) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<{ name: string; address: string; lng: number; lat: number } | null>(null);
  const [batchText, setBatchText] = useState('');
  const [batchAddresses, setBatchAddresses] = useState<BatchAddress[]>([]);
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [overlapPct, setOverlapPct] = useState(10);
  const [zoomLevel, setZoomLevel] = useState(18);
  const [isSearching, setIsSearching] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const mapRef = useRef<MapCanvasHandle>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const abortRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setLogs((prev) => [...prev, { time: now(), level, msg }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const updateCircle = useCallback((lng: number, lat: number, radius: number) => {
    const map = mapRef.current?.map;
    if (!map) return;
    const geojson = makeCircleGeoJSON(lng, lat, radius);
    const src = map.getSource(CIRCLE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(geojson);
    } else {
      map.addSource(CIRCLE_SOURCE, { type: 'geojson', data: geojson });
      map.addLayer({
        id: CIRCLE_SOURCE + '-fill',
        type: 'fill',
        source: CIRCLE_SOURCE,
        paint: { 'fill-color': '#06b6d4', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: CIRCLE_SOURCE + '-line',
        type: 'line',
        source: CIRCLE_SOURCE,
        paint: { 'line-color': '#06b6d4', 'line-width': 2 },
      });
    }
  }, []);

  const placeMarker = useCallback((lng: number, lat: number) => {
    const map = mapRef.current?.map;
    if (!map) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new mapboxgl.Marker({ color: '#06b6d4' })
      .setLngLat([lng, lat])
      .addTo(map);
    map.flyTo({ center: [lng, lat], zoom: 14 });
    updateCircle(lng, lat, radiusMeters);
  }, [radiusMeters, updateCircle]);

  // Update circle when radius changes and there's a selected address
  useEffect(() => {
    if (selectedAddress) {
      updateCircle(selectedAddress.lng, selectedAddress.lat, radiusMeters);
    }
  }, [radiusMeters, selectedAddress, updateCircle]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const { results, provider, error, fallbackReason } = await searchLocations(searchQuery.trim());
      setSearchResults(results);
      if (provider === 'osm' && fallbackReason) {
        addLog('warn', `高德搜索不可用，已切换备用搜索: ${fallbackReason}`);
      }
      if (!results.length) {
        addLog(error ? 'error' : 'warn', error ? `搜索失败: ${error}` : `未找到地址: ${searchQuery}`);
      }
    } catch (e) {
      addLog('error', `搜索失败: ${String(e)}`);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, addLog]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    const [lng, lat] = resolveSearchCoordinates(result);
    setSelectedAddress({ name: result.name, address: result.address || result.name, lng, lat });
    setSearchResults([]);
    placeMarker(lng, lat);
    addLog('info', `已选择: ${result.name}`);
  }, [placeMarker, addLog]);

  const handleParseBatch = useCallback(async () => {
    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const initial: BatchAddress[] = lines.map((text) => ({ text, status: 'pending' }));
    setBatchAddresses(initial);
    addLog('info', `开始解析 ${lines.length} 个地址...`);

    for (let i = 0; i < lines.length; i++) {
      try {
        const { results, provider, error, fallbackReason } = await searchLocations(lines[i]);
        if (results.length) {
          const [lng, lat] = resolveSearchCoordinates(results[0]);
          setBatchAddresses((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'done', lng, lat, resolvedAddress: results[0].address || lines[i] };
            return next;
          });
          if (provider === 'osm' && fallbackReason) {
            addLog('warn', `高德搜索不可用，${lines[i]} 已切换备用搜索: ${fallbackReason}`);
          }
          addLog('info', `解析成功: ${lines[i]}`);
        } else {
          setBatchAddresses((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'error' };
            return next;
          });
          addLog(error ? 'error' : 'warn', error ? `解析失败: ${lines[i]} (${error})` : `解析失败: ${lines[i]}`);
        }
      } catch {
        setBatchAddresses((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error' };
          return next;
        });
        addLog('error', `解析异常: ${lines[i]}`);
      }
    }
    addLog('info', '地址解析完成');
  }, [batchText, addLog]);

  const handleBatchItemClick = useCallback((item: BatchAddress) => {
    if (item.lng !== undefined && item.lat !== undefined) {
      placeMarker(item.lng, item.lat);
    }
  }, [placeMarker]);

  const handleRemoveBatchItem = useCallback((index: number) => {
    setBatchAddresses((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartCapture = useCallback(async () => {
    const map = mapRef.current?.map;
    if (!map) { addLog('error', '地图未就绪'); return; }

    abortRef.current = false;
    setIsCapturing(true);
    setProgress(0);
    setProgressTotal(0);
    setLogs([]);

    try {
      if (mode === 'single') {
        if (!selectedAddress) { addLog('error', '请先选择地址'); setIsCapturing(false); return; }
        const gridCount = estimateAddressGridCount(radiusMeters, zoomLevel, 1280, 720, selectedAddress.lat).total;
        addLog('info', `${selectedAddress.name}：zoom=${zoomLevel}，预计 ${gridCount} 张瓦片拼合`);
        setProgressTotal(gridCount);
        const result = await runAddressCapture({
          map,
          centerLng: selectedAddress.lng,
          centerLat: selectedAddress.lat,
          radiusMeters,
          zoomLevel,
          overlapRatio: overlapPct / 100,
          addressLabel: selectedAddress.name,
          resolvedAddress: selectedAddress.address,
          enterpriseId: null,
          onProgress: (done, total) => { setProgress(done); setProgressTotal(total); },
          onLog: (msg, type) => addLog(type === 'error' ? 'error' : type === 'success' ? 'info' : 'info', msg),
          shouldStop: () => abortRef.current,
        });
        if (result) {
          addLog('info', `完成，拼合图已上传`);
          onComplete([result]);
        } else {
          addLog('warn', '截图被中止或失败');
        }
      } else {
        const valid = batchAddresses.filter((a) => a.status === 'done' && a.lng !== undefined && a.lat !== undefined);
        if (!valid.length) { addLog('error', '没有可用的已解析地址'); setIsCapturing(false); return; }
        const totalTiles = valid.reduce((sum, a) => sum + estimateAddressGridCount(radiusMeters, zoomLevel, 1280, 720, a.lat!).total, 0);
        setProgressTotal(totalTiles);
        addLog('info', `批量 ${valid.length} 个地址，预计共 ${totalTiles} 张瓦片`);
        let doneCount = 0;
        const allResults: CaptureResult[] = [];
        for (const addr of valid) {
          if (abortRef.current) break;
          addLog('info', `处理: ${addr.text}`);
          const result = await runAddressCapture({
            map,
            centerLng: addr.lng!,
            centerLat: addr.lat!,
            radiusMeters,
            zoomLevel,
            overlapRatio: overlapPct / 100,
            addressLabel: addr.text,
            resolvedAddress: addr.resolvedAddress || addr.text,
            onProgress: (done) => { setProgress(doneCount + done); },
            onLog: (msg, type) => addLog(type === 'error' ? 'error' : 'info', msg),
            shouldStop: () => abortRef.current,
          });
          if (result) {
            allResults.push(result);
            doneCount += estimateAddressGridCount(radiusMeters, zoomLevel, 1280, 720, addr.lat!).total;
          }
        }
        addLog('info', `批量完成，共 ${allResults.length} 张拼合图`);
        onComplete(allResults);
      }
    } catch (e) {
      addLog('error', `捕获异常: ${String(e)}`);
    } finally {
      setIsCapturing(false);
    }
  }, [mode, selectedAddress, batchAddresses, radiusMeters, zoomLevel, overlapPct, addLog, onComplete]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    addLog('warn', '用户中止捕获');
  }, [addLog]);

  const logColor = (level: LogEntry['level']) => {
    if (level === 'error') return 'text-red-400';
    if (level === 'warn') return 'text-yellow-400';
    return 'text-slate-300';
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 bg-slate-900 flex flex-col overflow-y-auto border-r border-slate-700">
        {/* Mode tabs */}
        <div className="flex border-b border-slate-700">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'single' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setMode('single')}
          >
            单地址
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'batch' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setMode('batch')}
          >
            批量地址
          </button>
        </div>

        <div className="flex flex-col gap-3 p-3 flex-1">
          {/* Single mode */}
          {mode === 'single' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入地址搜索..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-white"
                >
                  <Search size={14} />
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectResult(r)}
                      className="text-left px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 transition-colors"
                    >
                      <div className="text-xs text-slate-200 truncate">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.address}</div>
                    </button>
                  ))}
                </div>
              )}

              {selectedAddress && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-green-900/40 border border-green-700 rounded">
                  <MapPin size={12} className="text-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-300 truncate">{selectedAddress.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Batch mode */}
          {mode === 'batch' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={'每行一个地址，例如：\n上海市浦东新区\n北京市朝阳区'}
                rows={5}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
              <button
                onClick={handleParseBatch}
                className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
              >
                <Plus size={14} />
                解析地址
              </button>

              {batchAddresses.length > 0 && (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {batchAddresses.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors"
                      onClick={() => handleBatchItemClick(item)}
                    >
                      <span className="flex-shrink-0">
                        {item.status === 'done' && <span className="text-green-400 text-xs">✓</span>}
                        {item.status === 'error' && <span className="text-red-400 text-xs">✗</span>}
                        {item.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />}
                      </span>
                      <span className="flex-1 text-xs text-slate-300 truncate">{item.text}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveBatchItem(i); }}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shared params */}
          <div className="flex flex-col gap-3 border-t border-slate-700 pt-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>半径</span>
                <span className="text-cyan-400">{radiusMeters}m</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>最大缩放级别</span>
                <span className="text-cyan-400">{zoomLevel}（自动适配半径）</span>
              </div>
              <input
                type="range"
                min={14}
                max={20}
                step={1}
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>重叠率</span>
                <span className="text-cyan-400">{overlapPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={overlapPct}
                onChange={(e) => setOverlapPct(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {/* Progress */}
          {isCapturing && progressTotal > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>进度</span>
                <span className="text-cyan-400">{progress}/{progressTotal}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-cyan-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progressTotal > 0 ? (progress / progressTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Start/Stop button */}
          <button
            onClick={isCapturing ? handleStop : handleStartCapture}
            className={`flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors ${
              isCapturing
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {isCapturing ? (
              <>
                <StopCircle size={15} />
                停止
              </>
            ) : (
              <>
                <Play size={15} />
                开始截图
              </>
            )}
          </button>

          {/* Log panel */}
          <div className="flex flex-col gap-0.5 h-36 overflow-y-auto bg-slate-950 rounded border border-slate-700 p-2">
            {logs.length === 0 && (
              <span className="text-xs text-slate-600">日志输出...</span>
            )}
            {logs.map((entry, i) => (
              <div key={i} className={`text-xs font-mono ${logColor(entry.level)}`}>
                <span className="text-slate-600">{entry.time} </span>
                {entry.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        <MapCanvas ref={mapRef} token={token} />
      </div>
    </div>
  );
}
