import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../lib/supabase';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface ScreenshotResult {
  filename: string;
  dataUrl: string;
  publicUrl: string | null;
  row: number;
  col: number;
  lng: number;
  lat: number;
}

interface Props {
  onScreenshotsComplete?: (results: ScreenshotResult[]) => void;
}

const TOKEN_KEY = 'mapbox_token';

export default function MapScreenshot({ onScreenshotsComplete }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const shouldStopRef = useRef(false);
  const pickingModeRef = useRef<'topLeft' | 'bottomRight' | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [centerLng, setCenterLng] = useState(121.5);
  const [centerLat, setCenterLat] = useState(31.2);
  const [topLeftLng, setTopLeftLng] = useState(121.48);
  const [topLeftLat, setTopLeftLat] = useState(31.22);
  const [bottomRightLng, setBottomRightLng] = useState(121.52);
  const [bottomRightLat, setBottomRightLat] = useState(31.18);
  const [zoomLevel, setZoomLevel] = useState(18);
  const [pickingMode, setPickingMode] = useState<'topLeft' | 'bottomRight' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uploadToStorage, setUploadToStorage] = useState(true);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs(prev => [...prev, { time, message, type }]);
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 0);
  }, []);

  useEffect(() => { pickingModeRef.current = pickingMode; }, [pickingMode]);

  useEffect(() => {
    if (!mapContainerRef.current || !token) return;
    mapboxgl.accessToken = token;
    localStorage.setItem(TOKEN_KEY, token);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: 256,
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'google-satellite' }],
      },
      center: [centerLng, centerLat],
      zoom: zoomLevel,
      preserveDrawingBuffer: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('click', (e) => {
      const mode = pickingModeRef.current;
      if (!mode) return;
      const { lng, lat } = e.lngLat;
      if (mode === 'topLeft') {
        setTopLeftLng(+lng.toFixed(6));
        setTopLeftLat(+lat.toFixed(6));
      } else {
        setBottomRightLng(+lng.toFixed(6));
        setBottomRightLat(+lat.toFixed(6));
      }
      setPickingMode(null);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function startScreenshot() {
    const map = mapRef.current;
    if (!map) return;

    setIsProcessing(true);
    shouldStopRef.current = false;
    setLogs([]);
    addLog('开始截图任务...');

    map.setZoom(zoomLevel);
    await new Promise(r => setTimeout(r, 500));

    const bounds = map.getBounds();
    const spanLng = bounds.getEast() - bounds.getWest();
    const spanLat = bounds.getNorth() - bounds.getSouth();
    const stepLng = spanLng * 0.9;
    const stepLat = spanLat * 0.9;

    const minLng = Math.min(topLeftLng, bottomRightLng);
    const maxLng = Math.max(topLeftLng, bottomRightLng);
    const minLat = Math.min(topLeftLat, bottomRightLat);
    const maxLat = Math.max(topLeftLat, bottomRightLat);

    const tasks: Array<{ lng: number; lat: number; row: number; col: number }> = [];
    let row = 0;
    for (let lat = maxLat; lat > minLat - stepLat; lat -= stepLat) {
      let col = 0;
      for (let lng = minLng; lng < maxLng + stepLng; lng += stepLng) {
        const clampedLng = Math.min(lng, maxLng);
        const clampedLat = Math.max(lat, minLat);
        tasks.push({ lng: clampedLng, lat: clampedLat, row, col });
        col++;
      }
      row++;
    }

    addLog(`共 ${tasks.length} 个截图任务 (${row} 行)`);

    const waitForIdle = () => new Promise<void>((resolve) => {
      if (map.isStyleLoaded() && map.areTilesLoaded()) {
        resolve();
      } else {
        map.once('idle', () => resolve());
      }
    });

    const results: ScreenshotResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      if (shouldStopRef.current) {
        addLog('用户停止截图', 'error');
        break;
      }

      const task = tasks[i];
      addLog(`[${i + 1}/${tasks.length}] 移动到 (${task.lng.toFixed(4)}, ${task.lat.toFixed(4)})`);

      map.setCenter([task.lng, task.lat]);
      map.setZoom(zoomLevel);
      await waitForIdle();
      await new Promise(r => setTimeout(r, 1500));

      const canvas = map.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const filename = `tile_z${zoomLevel}_r${task.row}_c${task.col}.png`;

      let publicUrl: string | null = null;

      if (uploadToStorage) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const path = `screenshots/${Date.now()}_${filename}`;
          const { error } = await supabase.storage
            .from('cooling-tower-images')
            .upload(path, blob, { contentType: 'image/png' });

          if (!error) {
            const { data: urlData } = supabase.storage
              .from('cooling-tower-images')
              .getPublicUrl(path);
            publicUrl = urlData.publicUrl;
          }
        } catch (err) {
          addLog(`上传失败: ${err}`, 'error');
        }
      } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }

      results.push({
        filename,
        dataUrl,
        publicUrl,
        row: task.row,
        col: task.col,
        lng: task.lng,
        lat: task.lat,
      });

      addLog(`✓ ${filename} 完成`, 'success');
    }

    addLog(`截图完成，共 ${results.length} 张`, 'success');
    onScreenshotsComplete?.(results);
    setIsProcessing(false);
  }

  return (
    <div className="flex h-full">
      {/* 左侧控制面板 */}
      <div className="w-72 flex-shrink-0 bg-slate-800/50 border-r border-slate-700/40 p-4 flex flex-col gap-3 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white">区域截图</h3>

        {/* Mapbox Token */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Mapbox Token</label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="pk.eyJ1..."
            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* 中心坐标 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">中心经度</label>
            <input type="number" step="0.001" value={centerLng} onChange={(e) => setCenterLng(+e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">中心纬度</label>
            <input type="number" step="0.001" value={centerLat} onChange={(e) => setCenterLat(+e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        {/* 左上角 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-slate-400">左上角坐标</label>
            <button
              onClick={() => setPickingMode(pickingMode === 'topLeft' ? null : 'topLeft')}
              className={`text-[10px] px-1.5 py-0.5 rounded ${pickingMode === 'topLeft' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              {pickingMode === 'topLeft' ? '点击地图...' : '地图拾取'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.0001" value={topLeftLng} onChange={(e) => setTopLeftLng(+e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50" />
            <input type="number" step="0.0001" value={topLeftLat} onChange={(e) => setTopLeftLat(+e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        {/* 右下角 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] text-slate-400">右下角坐标</label>
            <button
              onClick={() => setPickingMode(pickingMode === 'bottomRight' ? null : 'bottomRight')}
              className={`text-[10px] px-1.5 py-0.5 rounded ${pickingMode === 'bottomRight' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              {pickingMode === 'bottomRight' ? '点击地图...' : '地图拾取'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.0001" value={bottomRightLng} onChange={(e) => setBottomRightLng(+e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50" />
            <input type="number" step="0.0001" value={bottomRightLat} onChange={(e) => setBottomRightLat(+e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/50 rounded text-xs text-white focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        {/* Zoom */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">缩放级别: {zoomLevel}</label>
          <input type="range" min={14} max={20} value={zoomLevel} onChange={(e) => setZoomLevel(+e.target.value)}
            className="w-full accent-cyan-500" />
        </div>

        {/* 上传选项 */}
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={uploadToStorage} onChange={(e) => setUploadToStorage(e.target.checked)}
            className="accent-cyan-500" />
          上传到 Supabase Storage
        </label>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={startScreenshot}
            disabled={isProcessing || !token}
            className="flex-1 py-2 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {isProcessing ? '截图中...' : '开始截图'}
          </button>
          {isProcessing && (
            <button onClick={() => { shouldStopRef.current = true; }} className="px-3 py-2 rounded text-sm bg-red-600 hover:bg-red-500 text-white">
              停止
            </button>
          )}
        </div>

        {/* 日志 */}
        <div
          ref={logContainerRef}
          className="flex-1 min-h-32 bg-slate-900 rounded p-2 overflow-y-auto font-mono text-xs"
        >
          {logs.length === 0 && <span className="text-slate-600">等待操作...</span>}
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.type === 'success' ? 'text-green-400' : log.type === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
              <span className="text-slate-600 mr-2">{log.time}</span>
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {/* 地图 */}
      <div className="flex-1 relative">
        {!token && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <p className="text-slate-500 text-sm">请在左侧输入 Mapbox Token 以初始化地图</p>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
