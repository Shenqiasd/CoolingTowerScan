import { useState, useRef, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { Play, StopCircle, ChevronDown, ChevronUp, MousePointer2, Move } from 'lucide-react';
import MapCanvas, { type MapCanvasHandle } from './MapCanvas';
import { runCapture, buildAreaTasks, estimateTaskCount, type CaptureResult } from './CaptureEngine';

interface Props {
  token: string;
  onComplete: (results: CaptureResult[]) => void;
}

interface LogEntry { time: string; message: string; type: 'info' | 'success' | 'error'; }

const GRID_SOURCE = 'capture-grid';
const GRID_FILL = 'capture-grid-fill';
const GRID_LINE = 'capture-grid-line';
const BOX_SOURCE = 'select-box';

export default function AreaMode({ token, onComplete }: Props) {
  const canvasRef = useRef<MapCanvasHandle>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const shouldStopRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ lng: number; lat: number } | null>(null);

  const [topLeftLng, setTopLeftLng] = useState(121.48);
  const [topLeftLat, setTopLeftLat] = useState(31.22);
  const [bottomRightLng, setBottomRightLng] = useState(121.52);
  const [bottomRightLat, setBottomRightLat] = useState(31.18);
  const [zoomLevel, setZoomLevel] = useState(18);
  const [overlapPct, setOverlapPct] = useState(10);
  const [delayMs, setDelayMs] = useState(1500);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [label, setLabel] = useState('');
  const [pickingMode, setPickingMode] = useState<'topLeft' | 'bottomRight' | 'drag' | null>(null);
  const [preview, setPreview] = useState<{ rows: number; cols: number; total: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    setLogs(prev => [...prev, { time: t, message: msg, type }]);
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const refreshOverlay = useCallback((tl: [number,number], br: [number,number], zoom: number, overlap: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setZoom(zoom);
    const b = map.getBounds();
    const sLng = b.getEast() - b.getWest();
    const sLat = b.getNorth() - b.getSouth();
    const ratio = overlap / 100;
    const stepLng = sLng * (1 - ratio);
    const stepLat = sLat * (1 - ratio);
    setPreview(estimateTaskCount(sLng, sLat, tl[0], tl[1], br[0], br[1], ratio));

    const cells: GeoJSON.Feature[] = [];
    let cLat = tl[1] - sLat / 2;
    while (cLat + sLat / 2 >= br[1]) {
      let cLng = tl[0] + sLng / 2;
      while (cLng - sLng / 2 <= br[0]) {
        cells.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[cLng-sLng/2,cLat-sLat/2],[cLng+sLng/2,cLat-sLat/2],[cLng+sLng/2,cLat+sLat/2],[cLng-sLng/2,cLat+sLat/2],[cLng-sLng/2,cLat-sLat/2]]] } });
        cLng += stepLng;
      }
      cLat -= stepLat;
    }
    const gridGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: cells };
    if (map.getSource(GRID_SOURCE)) { (map.getSource(GRID_SOURCE) as mapboxgl.GeoJSONSource).setData(gridGeo); }
    else {
      map.addSource(GRID_SOURCE, { type: 'geojson', data: gridGeo });
      map.addLayer({ id: GRID_FILL, type: 'fill', source: GRID_SOURCE, paint: { 'fill-color': '#06b6d4', 'fill-opacity': 0.08 } });
      map.addLayer({ id: GRID_LINE, type: 'line', source: GRID_SOURCE, paint: { 'line-color': '#06b6d4', 'line-width': 1, 'line-opacity': 0.6 } });
    }
    const boxGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[tl[0],tl[1]],[br[0],tl[1]],[br[0],br[1]],[tl[0],br[1]],[tl[0],tl[1]]]] } }] };
    if (map.getSource(BOX_SOURCE)) { (map.getSource(BOX_SOURCE) as mapboxgl.GeoJSONSource).setData(boxGeo); }
    else {
      map.addSource(BOX_SOURCE, { type: 'geojson', data: boxGeo });
      map.addLayer({ id: 'box-fill', type: 'fill', source: BOX_SOURCE, paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.1 } });
      map.addLayer({ id: 'box-line', type: 'line', source: BOX_SOURCE, paint: { 'line-color': '#f59e0b', 'line-width': 2, 'line-dasharray': [4, 2] } });
    }
  }, []);

  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) refreshOverlay([topLeftLng,topLeftLat],[bottomRightLng,bottomRightLat],zoomLevel,overlapPct);
  }, [topLeftLng,topLeftLat,bottomRightLng,bottomRightLat,zoomLevel,overlapPct,refreshOverlay]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    refreshOverlay([topLeftLng,topLeftLat],[bottomRightLng,bottomRightLat],zoomLevel,overlapPct);
  }, [topLeftLng,topLeftLat,bottomRightLng,bottomRightLat,zoomLevel,overlapPct,refreshOverlay]);

  const handleClick = useCallback((lng: number, lat: number) => {
    if (pickingMode === 'topLeft') { setTopLeftLng(+lng.toFixed(6)); setTopLeftLat(+lat.toFixed(6)); setPickingMode(null); addLog(`左上角: [${lng.toFixed(6)}, ${lat.toFixed(6)}]`, 'success'); }
    else if (pickingMode === 'bottomRight') { setBottomRightLng(+lng.toFixed(6)); setBottomRightLat(+lat.toFixed(6)); setPickingMode(null); addLog(`右下角: [${lng.toFixed(6)}, ${lat.toFixed(6)}]`, 'success'); }
  }, [pickingMode, addLog]);

  const handleMouseDown = useCallback((lng: number, lat: number, e: mapboxgl.MapMouseEvent) => {
    if (pickingMode !== 'drag') return;
    e.preventDefault();
    dragStartRef.current = { lng, lat };
  }, [pickingMode]);

  const handleMouseMove = useCallback((lng: number, lat: number) => {
    if (pickingMode !== 'drag' || !dragStartRef.current) return;
    const s = dragStartRef.current;
    const tl: [number,number] = [Math.min(s.lng, lng), Math.max(s.lat, lat)];
    const br: [number,number] = [Math.max(s.lng, lng), Math.min(s.lat, lat)];
    const map = mapRef.current;
    if (!map) return;
    const boxGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[tl[0],tl[1]],[br[0],tl[1]],[br[0],br[1]],[tl[0],br[1]],[tl[0],tl[1]]]] } }] };
    if (map.getSource(BOX_SOURCE)) (map.getSource(BOX_SOURCE) as mapboxgl.GeoJSONSource).setData(boxGeo);
  }, [pickingMode]);

  const handleMouseUp = useCallback((lng: number, lat: number) => {
    if (pickingMode !== 'drag' || !dragStartRef.current) return;
    const s = dragStartRef.current;
    dragStartRef.current = null;
    const tl: [number,number] = [Math.min(s.lng, lng), Math.max(s.lat, lat)];
    const br: [number,number] = [Math.max(s.lng, lng), Math.min(s.lat, lat)];
    setTopLeftLng(+tl[0].toFixed(6)); setTopLeftLat(+tl[1].toFixed(6));
    setBottomRightLng(+br[0].toFixed(6)); setBottomRightLat(+br[1].toFixed(6));
    setPickingMode(null);
    addLog(`框选完成: [${tl[0].toFixed(4)},${tl[1].toFixed(4)}] → [${br[0].toFixed(4)},${br[1].toFixed(4)}]`, 'success');
  }, [pickingMode, addLog]);

  const cursor = pickingMode === 'drag' ? 'crosshair' : pickingMode ? 'crosshair' : '';

  const handleCapture = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (topLeftLat <= bottomRightLat) { addLog('左上角纬度必须大于右下角纬度', 'error'); return; }
    if (topLeftLng >= bottomRightLng) { addLog('左上角经度必须小于右下角经度', 'error'); return; }

    setIsCapturing(true);
    shouldStopRef.current = false;
    setLogs([]);
    setProgress(0);

    map.setZoom(zoomLevel);
    map.setCenter([(topLeftLng + bottomRightLng) / 2, (topLeftLat + bottomRightLat) / 2]);
    await new Promise(r => setTimeout(r, 800));

    const tasks = buildAreaTasks(map, topLeftLng, topLeftLat, bottomRightLng, bottomRightLat, overlapPct / 100);
    setProgressTotal(tasks.length);
    addLog(`共 ${tasks.length} 张截图 (${preview?.rows ?? '?'} 行 × ${preview?.cols ?? '?'} 列)`, 'info');

    const results = await runCapture({
      map, tasks, zoomLevel, mode: 'area', label: label || undefined, delayMs,
      onProgress: (done, total) => setProgress(done),
      onLog: addLog,
      shouldStop: () => shouldStopRef.current,
    });

    setIsCapturing(false);
    addLog(`完成！共 ${results.length} 张截图已上传`, 'success');
    onComplete(results);
  }, [topLeftLng, topLeftLat, bottomRightLng, bottomRightLat, zoomLevel, overlapPct, delayMs, label, preview, addLog, onComplete]);

  const coordInput = (label: string, val: number, set: (v: number) => void) => (
    <input
      type="number" step="0.0001" value={val}
      onChange={e => set(parseFloat(e.target.value) || 0)}
      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
      placeholder={label}
    />
  );

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Drag-select button */}
          <button
            onClick={() => setPickingMode(p => p === 'drag' ? null : 'drag')}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors ${pickingMode === 'drag' ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
          >
            <Move className="w-4 h-4" />
            {pickingMode === 'drag' ? '在地图上拖拽框选...' : '拖拽框选区域'}
          </button>

          {/* Bounds inputs */}
          <div className="space-y-2">
            <div className="text-xs text-slate-400 font-medium">左上角</div>
            <div className="grid grid-cols-2 gap-1">
              {coordInput('经度', topLeftLng, setTopLeftLng)}
              {coordInput('纬度', topLeftLat, setTopLeftLat)}
            </div>
            <button onClick={() => setPickingMode(p => p === 'topLeft' ? null : 'topLeft')} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${pickingMode === 'topLeft' ? 'bg-cyan-600 text-white' : 'text-cyan-400 hover:text-cyan-300'}`}>
              <MousePointer2 className="w-3 h-3" />
              {pickingMode === 'topLeft' ? '点击地图拾取...' : '拾取左上角'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-400 font-medium">右下角</div>
            <div className="grid grid-cols-2 gap-1">
              {coordInput('经度', bottomRightLng, setBottomRightLng)}
              {coordInput('纬度', bottomRightLat, setBottomRightLat)}
            </div>
            <button onClick={() => setPickingMode(p => p === 'bottomRight' ? null : 'bottomRight')} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${pickingMode === 'bottomRight' ? 'bg-cyan-600 text-white' : 'text-cyan-400 hover:text-cyan-300'}`}>
              <MousePointer2 className="w-3 h-3" />
              {pickingMode === 'bottomRight' ? '点击地图拾取...' : '拾取右下角'}
            </button>
          </div>

          {/* Zoom */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>缩放层级</span><span className="text-white font-mono">{zoomLevel}</span></div>
            <input type="range" min={14} max={20} value={zoomLevel} onChange={e => setZoomLevel(+e.target.value)} className="w-full accent-cyan-500" />
            <div className="flex justify-between text-xs text-slate-600"><span>14 (宽)</span><span>20 (精细)</span></div>
          </div>

          {/* Overlap */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>重叠率</span><span className="text-white font-mono">{overlapPct}%</span></div>
            <input type="range" min={0} max={30} value={overlapPct} onChange={e => setOverlapPct(+e.target.value)} className="w-full accent-cyan-500" />
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-slate-800/60 rounded p-3 space-y-1 text-xs">
              <div className="text-slate-400">预计截图</div>
              <div className="text-white font-mono text-lg">{preview.total} 张</div>
              <div className="text-slate-500">{preview.rows} 行 × {preview.cols} 列</div>
            </div>
          )}

          {/* Label */}
          <input
            type="text" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="任务备注（可选）"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />

          {/* Advanced */}
          <button onClick={() => setShowAdvanced(p => !p)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            高级选项
          </button>
          {showAdvanced && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400"><span>截图间隔 (ms)</span><span className="text-white font-mono">{delayMs}</span></div>
              <input type="range" min={500} max={5000} step={100} value={delayMs} onChange={e => setDelayMs(+e.target.value)} className="w-full accent-cyan-500" />
            </div>
          )}

          {/* Progress */}
          {isCapturing && progressTotal > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400"><span>进度</span><span>{progress}/{progressTotal}</span></div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 transition-all" style={{ width: `${(progress / progressTotal) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCapture}
              disabled={isCapturing || !token}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Play className="w-4 h-4" />
              {isCapturing ? '截图中...' : '开始截图'}
            </button>
            {isCapturing && (
              <button onClick={() => { shouldStopRef.current = true; }} className="px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-white">
                <StopCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Log */}
          <div className="bg-slate-950 rounded p-2 h-40 overflow-y-auto font-mono text-xs">
            {logs.length === 0 && <span className="text-slate-600">等待操作...</span>}
            {logs.map((log, i) => (
              <div key={i} className={`mb-0.5 ${log.type === 'success' ? 'text-green-400' : log.type === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                <span className="text-slate-600 mr-1.5">{log.time}</span>{log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!token && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <p className="text-slate-500 text-sm">请先在设置中输入 Mapbox Token</p>
          </div>
        )}
        <MapCanvas
          ref={canvasRef}
          token={token}
          initialCenter={[121.5, 31.2]}
          initialZoom={12}
          onReady={handleMapReady}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          cursor={cursor}
        />
      </div>
    </div>
  );
}
