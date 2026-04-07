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
  const [autoDetect, setAutoDetect] = useState(false);
  const [detectionApiUrl, setDetectionApiUrl] = useState(
    () => localStorage.getItem('detection_api_url') || 'http://localhost:8000'
  );

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
        layers: [{ id: 'google-satellite-layer', type: 'raster', source: 'google-satellite' }],
      },
      center: [centerLng, centerLat],
      zoom: 12,
      preserveDrawingBuffer: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => addLog('地图初始化完成', 'success'));
    map.on('click', (e) => {
      const mode = pickingModeRef.current;
      if (!mode) return;
      const lng = Number(e.lngLat.lng.toFixed(6));
      const lat = Number(e.lngLat.lat.toFixed(6));
      if (mode === 'topLeft') {
        setTopLeftLng(lng); setTopLeftLat(lat);
        addLog(`已拾取左上角: [${lng}, ${lat}]`, 'success');
      } else {
        setBottomRightLng(lng); setBottomRightLat(lat);
        addLog(`已拾取右下角: [${lng}, ${lat}]`, 'success');
      }
      setPickingMode(null);
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = pickingMode ? 'crosshair' : '';
  }, [pickingMode]);

  const waitForIdle = () => new Promise<void>((resolve) => {
    const map = mapRef.current!;
    if (map.isStyleLoaded() && map.areTilesLoaded()) { resolve(); return; }
    map.once('idle', () => resolve());
    setTimeout(resolve, 5000);
  });

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const uploadImage = async (filename: string, dataUrl: string): Promise<string | null> => {
    try {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      const path = `screenshots/${filename}.png`;
      const { error } = await supabase.storage
        .from('cooling-tower-images')
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('cooling-tower-images').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      addLog(`上传失败: ${(err as Error).message}`, 'error');
      return null;
    }
  };

  const downloadImage = (filename: string, dataUrl: string) => {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `${filename}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const runDetection = async (dataUrl: string, filename: string, _lng: number, _lat: number) => {
    try {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', blob, `${filename}.png`);

      const url = localStorage.getItem('detection_api_url') || detectionApiUrl;
      const res = await fetch(`${url}/detect`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      addLog(
        `检测完成: ${result.has_cooling_tower ? `发现 ${result.count} 个冷却塔 (置信度 ${(result.confidence * 100).toFixed(1)}%)` : '未检测到冷却塔'}`,
        result.has_cooling_tower ? 'success' : 'info'
      );
      return result;
    } catch (err) {
      addLog(`检测失败: ${(err as Error).message}`, 'error');
      return null;
    }
  };

  const startProcess = async () => {
    const map = mapRef.current;
    if (!map) { addLog('地图未初始化，请先输入 Mapbox Token', 'error'); return; }
    if (topLeftLat <= bottomRightLat) { addLog('左上角纬度必须大于右下角纬度', 'error'); return; }
    if (topLeftLng >= bottomRightLng) { addLog('左上角经度必须小于右下角经度', 'error'); return; }

    setIsProcessing(true);
    shouldStopRef.current = false;
    setLogs([]);
    addLog('开始准备地毯式截图任务...', 'info');
    const results: ScreenshotResult[] = [];

    try {
      map.setZoom(zoomLevel);
      map.setCenter([topLeftLng, topLeftLat]);
      await sleep(1000);
      await waitForIdle();

      const bounds = map.getBounds()!;
      const spanLng = bounds.getEast() - bounds.getWest();
      const spanLat = bounds.getNorth() - bounds.getSouth();
      const stepLng = spanLng * 0.9;
      const stepLat = spanLat * 0.9;

      if (stepLng <= 0 || stepLat <= 0) throw new Error('地图视野获取失败');

      addLog(`视野跨度: 经度 ${spanLng.toFixed(4)}, 纬度 ${spanLat.toFixed(4)}`, 'info');

      const taskList: { row: number; col: number; lng: number; lat: number }[] = [];
      let currentLat = topLeftLat - spanLat / 2;
      let row = 0;
      while (currentLat + spanLat / 2 >= bottomRightLat) {
        let currentLng = topLeftLng + spanLng / 2;
        let col = 0;
        while (currentLng - spanLng / 2 <= bottomRightLng) {
          taskList.push({ row, col, lng: currentLng, lat: currentLat });
          currentLng += stepLng; col++;
        }
        currentLat -= stepLat; row++;
      }

      addLog(`共需截图 ${taskList.length} 张`, 'success');

      for (let i = 0; i < taskList.length; i++) {
        if (shouldStopRef.current) { addLog('已手动停止', 'error'); break; }
        const task = taskList[i];
        addLog(`处理 [${i + 1}/${taskList.length}] R${task.row}_C${task.col}...`, 'info');

        map.jumpTo({ center: [task.lng, task.lat], zoom: zoomLevel });
        await sleep(1500);
        await waitForIdle();

        const canvas = map.getCanvas();
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `区域截图_R${task.row}_C${task.col}_Z${zoomLevel}`;

        let publicUrl: string | null = null;
        if (uploadToStorage) {
          publicUrl = await uploadImage(filename, dataUrl);
          if (publicUrl) addLog(`已上传: ${filename}`, 'success');
        } else {
          downloadImage(filename, dataUrl);
          addLog(`已下载: ${filename}`, 'success');
        }

        if (autoDetect) {
          await runDetection(dataUrl, filename, task.lng, task.lat);
        }

        results.push({ filename, dataUrl, publicUrl, row: task.row, col: task.col, lng: task.lng, lat: task.lat });
      }

      if (!shouldStopRef.current) {
        addLog(`所有截图完成！共 ${results.length} 张`, 'success');
        onScreenshotsComplete?.(results);
      }
    } catch (err) {
      addLog(`出错: ${(err as Error).message}`, 'error');
    } finally {
      setIsProcessing(false);
      shouldStopRef.current = false;
    }
  };

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500';
  const btnCls = (active?: boolean) => `px-3 py-1 rounded text-xs font-medium transition-colors ${active ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`;

  return (
    <div className="flex h-full gap-0">
      {/* 控制面板 */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto p-4 gap-3 shrink-0">
        <h2 className="text-sm font-semibold text-white">地毯式卫星截图</h2>

        {/* Token */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Mapbox Token</label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="pk.eyJ1..."
            className={inputCls}
          />
        </div>

        {/* 中心点 */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">地图中心点</label>
          <div className="flex gap-2">
            <input type="number" value={centerLng} onChange={e => setCenterLng(Number(e.target.value))} placeholder="经度" className={inputCls} step="0.001" />
            <input type="number" value={centerLat} onChange={e => setCenterLat(Number(e.target.value))} placeholder="纬度" className={inputCls} step="0.001" />
          </div>
          <div className="flex gap-2 mt-1">
            <button className={btnCls()} onClick={() => mapRef.current?.flyTo({ center: [centerLng, centerLat], zoom: 12 })}>定位</button>
            <button className={btnCls()} onClick={() => { const c = mapRef.current?.getCenter(); if (c) { setCenterLng(Number(c.lng.toFixed(6))); setCenterLat(Number(c.lat.toFixed(6))); } }}>从地图获取</button>
          </div>
        </div>

        <hr className="border-slate-700" />

        {/* 左上角 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">左上角经纬度</label>
            <button className={btnCls(pickingMode === 'topLeft')} onClick={() => setPickingMode(m => m === 'topLeft' ? null : 'topLeft')}>
              {pickingMode === 'topLeft' ? '点击地图...' : '地图拾取'}
            </button>
          </div>
          <div className="flex gap-2">
            <input type="number" value={topLeftLng} onChange={e => setTopLeftLng(Number(e.target.value))} placeholder="经度" className={inputCls} step="0.001" />
            <input type="number" value={topLeftLat} onChange={e => setTopLeftLat(Number(e.target.value))} placeholder="纬度" className={inputCls} step="0.001" />
          </div>
        </div>

        {/* 右下角 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">右下角经纬度</label>
            <button className={btnCls(pickingMode === 'bottomRight')} onClick={() => setPickingMode(m => m === 'bottomRight' ? null : 'bottomRight')}>
              {pickingMode === 'bottomRight' ? '点击地图...' : '地图拾取'}
            </button>
          </div>
          <div className="flex gap-2">
            <input type="number" value={bottomRightLng} onChange={e => setBottomRightLng(Number(e.target.value))} placeholder="经度" className={inputCls} step="0.001" />
            <input type="number" value={bottomRightLat} onChange={e => setBottomRightLat(Number(e.target.value))} placeholder="纬度" className={inputCls} step="0.001" />
          </div>
        </div>

        {/* Zoom */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">截图层级 (Zoom): {zoomLevel}</label>
          <input type="range" min={14} max={22} value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))} className="w-full accent-cyan-500" />
        </div>

        {/* 上传选项 */}
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={uploadToStorage} onChange={e => setUploadToStorage(e.target.checked)} className="accent-cyan-500" />
          上传到 Supabase Storage（否则直接下载）
        </label>

        {/* 自动检测 */}
        <div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer mb-1">
            <input type="checkbox" checked={autoDetect} onChange={e => setAutoDetect(e.target.checked)} className="accent-cyan-500" />
            截图后自动调用冷却塔识别
          </label>
          {autoDetect && (
            <input
              type="text"
              value={detectionApiUrl}
              onChange={e => { setDetectionApiUrl(e.target.value); localStorage.setItem('detection_api_url', e.target.value); }}
              placeholder="http://localhost:8000"
              className={inputCls}
            />
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={startProcess}
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
