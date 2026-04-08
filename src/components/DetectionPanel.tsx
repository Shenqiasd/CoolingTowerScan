import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Radar, Play, Square, CheckCircle2, XCircle, Loader2,
  Settings2, RefreshCw, X, Minus,
} from 'lucide-react';
import type { CaptureResult, ScanDetection } from '../types/pipeline';
import { detectImage, getDetectionApiUrl, setDetectionApiUrl, checkHealth } from '../utils/detectionApi';
import { saveDetectionResult, clearDetectionResults } from '../utils/detectionPersistence';

// ─── helpers ────────────────────────────────────────────────────────────────

const CONF_KEY = 'detection_conf_threshold';

function loadConf(): number {
  const v = parseFloat(localStorage.getItem(CONF_KEY) ?? '');
  return isNaN(v) ? 0.25 : v;
}

// ─── DetectionImageModal ─────────────────────────────────────────────────────

interface ModalProps {
  shot: CaptureResult;
  detection: ScanDetection | undefined;
  onClose: () => void;
}

function DetectionImageModal({ shot, detection, onClose }: ModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const src = shot.dataUrl || shot.publicUrl || '';

  const drawBoxes = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !detection) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of detection.detections) {
      const x = d.x1;
      const y = d.y1;
      const w = d.x2 - d.x1;
      const h = d.y2 - d.y1;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2, canvas.width / 300);
      ctx.strokeRect(x, y, w, h);

      const label = `${(d.confidence * 100).toFixed(0)}%`;
      const fontSize = Math.max(12, canvas.width / 40);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textW = ctx.measureText(label).width;
      const pad = 4;

      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.fillRect(x, y - fontSize - pad * 2, textW + pad * 2, fontSize + pad * 2);

      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + pad, y - pad);
    }
  }, [detection]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      drawBoxes();
    } else {
      img.addEventListener('load', drawBoxes);
      return () => img.removeEventListener('load', drawBoxes);
    }
  }, [drawBoxes]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
          <img
            ref={imgRef}
            src={src}
            alt={shot.filename}
            className="w-full block"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        <div className="mt-2 text-xs text-slate-400 text-center">
          {shot.filename} — ({shot.lng.toFixed(5)}, {shot.lat.toFixed(5)})
          {detection?.hasCoolingTower && (
            <span className="ml-2 text-emerald-400">
              {detection.count} 个冷却塔 · 置信度 {(detection.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  screenshots: CaptureResult[];
  detections: ScanDetection[];
  onDetectionsUpdate: (detections: ScanDetection[]) => void;
  onStatusChange: (status: 'detecting' | 'complete' | 'idle') => void;
}

// ─── DetectionPanel ──────────────────────────────────────────────────────────

export default function DetectionPanel({ screenshots, detections, onDetectionsUpdate, onStatusChange }: Props) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [apiUrl, setApiUrl] = useState(getDetectionApiUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [conf, setConf] = useState<number>(loadConf);
  const [showBanner, setShowBanner] = useState(false);
  const [modalShot, setModalShot] = useState<CaptureResult | null>(null);
  const shouldStopRef = useRef(false);

  const handleCheckHealth = useCallback(async () => {
    const healthy = await checkHealth(apiUrl);
    setApiHealthy(healthy);
  }, [apiUrl]);

  const handleSaveApiUrl = useCallback(() => {
    setDetectionApiUrl(apiUrl);
    setShowSettings(false);
    handleCheckHealth();
  }, [apiUrl, handleCheckHealth]);

  const handleConfChange = useCallback((v: number) => {
    setConf(v);
    localStorage.setItem(CONF_KEY, String(v));
  }, []);

  // ── single-shot detection helper ──────────────────────────────────────────

  const runDetection = useCallback(async (
    shot: CaptureResult,
    currentDetections: ScanDetection[],
  ): Promise<ScanDetection> => {
    const src = shot.dataUrl || shot.publicUrl;
    if (!src) throw new Error('no image source');
    const blob = await (await fetch(src)).blob();
    const result = await detectImage(blob, shot.filename, apiUrl, conf);

    if (shot.screenshotId) {
      await saveDetectionResult(shot.screenshotId, shot.enterpriseId ?? null, result);
    }

    return {
      screenshotFilename: shot.filename,
      screenshotId: shot.screenshotId,
      enterpriseId: shot.enterpriseId ?? null,
      lng: shot.lng,
      lat: shot.lat,
      hasCoolingTower: result.has_cooling_tower,
      count: result.count,
      confidence: result.confidence,
      imageUrl: shot.publicUrl,
      detections: result.detections.map(d => ({
        class_name: d.class_name,
        confidence: d.confidence,
        x1: d.x1,
        y1: d.y1,
        x2: d.x2,
        y2: d.y2,
      })),
    };
  }, [apiUrl, conf]);

  // ── start full detection loop ─────────────────────────────────────────────

  const startDetection = useCallback(async () => {
    if (screenshots.length === 0) return;

    setIsDetecting(true);
    setShowBanner(false);
    shouldStopRef.current = false;
    onStatusChange('detecting');
    setProgress(0);

    const newDetections: ScanDetection[] = [...detections];

    for (let i = 0; i < screenshots.length; i++) {
      if (shouldStopRef.current) break;

      const shot = screenshots[i];

      if (newDetections.some(d => d.screenshotFilename === shot.filename)) {
        setProgress(i + 1);
        continue;
      }

      try {
        const det = await runDetection(shot, newDetections);
        newDetections.push(det);
        onDetectionsUpdate([...newDetections]);
      } catch (err) {
        newDetections.push({
          screenshotFilename: shot.filename,
          screenshotId: shot.screenshotId,
          enterpriseId: shot.enterpriseId ?? null,
          lng: shot.lng,
          lat: shot.lat,
          hasCoolingTower: false,
          count: 0,
          confidence: 0,
          imageUrl: shot.publicUrl,
          error: err instanceof Error ? err.message : String(err),
          detections: [],
        });
        onDetectionsUpdate([...newDetections]);
      }

      setProgress(i + 1);
    }

    setIsDetecting(false);

    if (!shouldStopRef.current) {
      setShowBanner(true);
      onStatusChange('complete');
    } else {
      onStatusChange('idle');
    }
  }, [screenshots, detections, runDetection, onDetectionsUpdate, onStatusChange]);

  const stopDetection = useCallback(() => {
    shouldStopRef.current = true;
  }, []);

  // ── retry single screenshot ───────────────────────────────────────────────

  const retryShot = useCallback(async (shot: CaptureResult) => {
    if (shot.screenshotId) {
      await clearDetectionResults(shot.screenshotId);
    }

    const without = detections.filter(d => d.screenshotFilename !== shot.filename);
    onDetectionsUpdate(without);

    try {
      const det = await runDetection(shot, without);
      onDetectionsUpdate([...without, det]);
    } catch (err) {
      onDetectionsUpdate([...without, {
        screenshotFilename: shot.filename,
        screenshotId: shot.screenshotId,
        enterpriseId: shot.enterpriseId ?? null,
        lng: shot.lng,
        lat: shot.lat,
        hasCoolingTower: false,
        count: 0,
        confidence: 0,
        imageUrl: shot.publicUrl,
        error: err instanceof Error ? err.message : String(err),
        detections: [],
      }]);
    }
  }, [detections, runDetection, onDetectionsUpdate]);

  // ── derived stats ─────────────────────────────────────────────────────────

  const detectedCount = detections.filter(d => d.hasCoolingTower).length;
  const totalTowers = detections.reduce((sum, d) => sum + d.count, 0);
  const enterprisesUpdated = detections.filter(d => d.hasCoolingTower && d.enterpriseId).length;

  // ── empty state ───────────────────────────────────────────────────────────

  if (screenshots.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Radar className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-sm">暂无截图数据</p>
          <p className="text-slate-600 text-xs">请先在"区域截图"步骤完成卫星图截取</p>
        </div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4 p-4">

      {/* Summary banner */}
      {showBanner && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-700/60 to-emerald-600/40 border border-emerald-500/30 text-sm">
          <div className="flex items-center gap-4 text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span>识别完成</span>
            <span className="text-emerald-200">共 {screenshots.length} 张</span>
            <span>·</span>
            <span className="text-emerald-200">发现冷却塔 {detectedCount} 处</span>
            <span>·</span>
            <span className="text-emerald-200">共 {totalTowers} 个</span>
            {enterprisesUpdated > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-200">更新企业 {enterprisesUpdated} 家</span>
              </>
            )}
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-emerald-300 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top control bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radar className="w-4 h-4 text-cyan-400" />
            AI 冷却塔识别
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>截图 {screenshots.length} 张</span>
            <span>·</span>
            <span>已识别 {detections.length} 张</span>
            <span>·</span>
            <span className="text-emerald-400">发现 {totalTowers} 个冷却塔</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="检测服务设置"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {!isDetecting ? (
            <button
              onClick={startDetection}
              disabled={screenshots.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              开始识别
            </button>
          ) : (
            <button
              onClick={stopDetection}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              停止
            </button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 whitespace-nowrap">检测服务地址</label>
            <input
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              placeholder="http://localhost:8000"
            />
            <button
              onClick={handleSaveApiUrl}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              保存
            </button>
            <button
              onClick={handleCheckHealth}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              测试
            </button>
            {apiHealthy !== null && (
              <span className={`text-xs ${apiHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                {apiHealthy ? '✓ 连接正常' : '✗ 无法连接'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 whitespace-nowrap">
              置信度阈值 <span className="text-white font-medium">{conf.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.05}
              value={conf}
              onChange={e => handleConfChange(parseFloat(e.target.value))}
              className="flex-1 accent-cyan-500"
            />
            <span className="text-xs text-slate-500 w-8 text-right">0.9</span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isDetecting && (
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              识别中...
            </span>
            <span>{progress}/{screenshots.length}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress / screenshots.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Screenshot grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {screenshots.map((shot) => {
            const detection = detections.find(d => d.screenshotFilename === shot.filename);
            const hasResult = !!detection;
            const hasTower = detection?.hasCoolingTower ?? false;
            const hasError = !!detection?.error;
            const isCurrentlyDetecting = isDetecting && !hasResult;
            const imgSrc = shot.dataUrl || shot.publicUrl || '';

            return (
              <div
                key={shot.filename}
                onClick={() => setModalShot(shot)}
                className={`relative rounded-lg overflow-hidden border cursor-pointer transition-all hover:ring-1 hover:ring-cyan-500/40 ${
                  hasError
                    ? 'border-red-500/50 ring-1 ring-red-500/20'
                    : hasTower
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                    : hasResult
                    ? 'border-slate-700/40'
                    : 'border-slate-700/20'
                }`}
              >
                <img
                  src={imgSrc}
                  alt={shot.filename}
                  className="w-full aspect-square object-cover"
                />

                {/* Status badge */}
                <div className="absolute top-1.5 right-1.5">
                  {hasError ? (
                    <div className="flex items-center gap-1 bg-red-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                      <XCircle className="w-3 h-3" />
                      错误
                    </div>
                  ) : hasResult ? (
                    hasTower ? (
                      <div className="flex items-center gap-1 bg-emerald-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {detection.count}个
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                        <Minus className="w-3 h-3" />
                        无
                      </div>
                    )
                  ) : isCurrentlyDetecting ? (
                    <div className="bg-slate-800/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                    </div>
                  ) : null}
                </div>

                {/* Retry button */}
                {hasError && (
                  <button
                    onClick={e => { e.stopPropagation(); retryShot(shot); }}
                    className="absolute top-1.5 left-1.5 bg-slate-800/80 backdrop-blur-sm p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    title="重试"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}

                {/* Bottom overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white/70 truncate">
                    ({shot.lng.toFixed(4)}, {shot.lat.toFixed(4)})
                  </p>
                  {hasTower && detection && (
                    <p className="text-[10px] text-emerald-400">
                      置信度 {(detection.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                  {hasError && detection?.error && (
                    <p className="text-[10px] text-red-400 truncate" title={detection.error}>
                      {detection.error}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom stats */}
      {detections.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-4 px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400">有冷却塔</span>
            <span className="text-white font-medium">{detectedCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400">无冷却塔</span>
            <span className="text-white font-medium">{detections.filter(d => !d.hasCoolingTower && !d.error).length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-slate-400">冷却塔总数</span>
            <span className="text-white font-medium">{totalTowers}</span>
          </div>
          {detections.some(d => d.error) && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-400">错误</span>
              <span className="text-white font-medium">{detections.filter(d => d.error).length}</span>
            </div>
          )}
        </div>
      )}

      {/* Bbox modal */}
      {modalShot && (
        <DetectionImageModal
          shot={modalShot}
          detection={detections.find(d => d.screenshotFilename === modalShot.filename)}
          onClose={() => setModalShot(null)}
        />
      )}
    </div>
  );
}
