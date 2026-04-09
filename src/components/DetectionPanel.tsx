import { useState, useCallback, useRef } from 'react';
import { Radar, Play, Square, CheckCircle2, X, Settings2 } from 'lucide-react';
import type { CaptureResult, ScanDetection, DetectionFilters } from '../types/pipeline';
import { detectImage, getDetectionApiUrl, setDetectionApiUrl, checkHealth } from '../utils/detectionApi';
import { saveDetectionResult, clearDetectionResults } from '../utils/detectionPersistence';
import { useScreenshotFilters, DEFAULT_FILTERS } from '../hooks/useScreenshotFilters';
import { useAnnotatedUpload } from '../hooks/useAnnotatedUpload';
import { useEnterpriseMatch } from '../hooks/useEnterpriseMatch';
import ScreenshotGrid from './detection/ScreenshotGrid';
import DetectionFilterBar from './detection/DetectionFilterBar';
import FloatingActionBar from './detection/FloatingActionBar';
import ReviewModal from './detection/ReviewModal';
import EnterpriseMatchModal from './detection/EnterpriseMatchModal';

const CONF_KEY = 'detection_conf_threshold';
function loadConf(): number {
  const v = parseFloat(localStorage.getItem(CONF_KEY) ?? '');
  return isNaN(v) ? 0.25 : v;
}

interface Props {
  screenshots: CaptureResult[];
  detections: ScanDetection[];
  onDetectionsUpdate: (detections: ScanDetection[]) => void;
  onStatusChange: (status: 'detecting' | 'complete' | 'idle') => void;
}

export default function DetectionPanel({
  screenshots, detections, onDetectionsUpdate, onStatusChange,
}: Props) {
  const [apiUrl, setApiUrl] = useState(getDetectionApiUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [conf, setConf] = useState<number>(loadConf);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const shouldStopRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<DetectionFilters>(DEFAULT_FILTERS);
  const filteredDetections = useScreenshotFilters(detections, filters);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [matchTarget, setMatchTarget] = useState<ScanDetection | null>(null);
  const { uploadAllAnnotated } = useAnnotatedUpload();
  const { confirm: confirmMatch } = useEnterpriseMatch();

  // ── helpers ──────────────────────────────────────────────────────────────

  const updateDetection = useCallback((filename: string, update: Partial<ScanDetection>) => {
    onDetectionsUpdate(
      detections.map(d => d.screenshotFilename === filename ? { ...d, ...update } : d)
    );
  }, [detections, onDetectionsUpdate]);

  const handleCheckHealth = useCallback(async () => {
    setApiHealthy(await checkHealth(apiUrl));
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

  // ── detection core ────────────────────────────────────────────────────────

  const runDetection = useCallback(async (shot: CaptureResult): Promise<ScanDetection> => {
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
      imageUrl: shot.publicUrl ?? shot.dataUrl ?? null,
      dataUrl: shot.dataUrl ?? null,
      publicUrl: shot.publicUrl,
      detections: result.detections.map(d => ({
        class_name: d.class_name,
        confidence: d.confidence,
        x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
      })),
    };
  }, [apiUrl, conf]);

  const makeErrorDet = useCallback((shot: CaptureResult, err: unknown): ScanDetection => ({
    screenshotFilename: shot.filename,
    screenshotId: shot.screenshotId,
    enterpriseId: shot.enterpriseId ?? null,
    lng: shot.lng,
    lat: shot.lat,
    hasCoolingTower: false,
    count: 0,
    confidence: 0,
    imageUrl: shot.publicUrl ?? shot.dataUrl ?? null,
    dataUrl: shot.dataUrl ?? null,
    publicUrl: shot.publicUrl,
    error: err instanceof Error ? err.message : String(err),
    detections: [],
  }), []);

  const handlePostDetection = useCallback(async (newTowerDets: ScanDetection[]) => {
    await uploadAllAnnotated(newTowerDets, updateDetection);
    const unmatched = newTowerDets.find(
      d => d.source === 'area' && !d.matchedEnterpriseId
    );
    if (unmatched) setMatchTarget(unmatched);
  }, [uploadAllAnnotated, updateDetection]);

  // ── handleDetect ──────────────────────────────────────────────────────────

  const handleDetect = useCallback(async () => {
    if (screenshots.length === 0) return;
    setIsDetecting(true);
    setShowBanner(false);
    shouldStopRef.current = false;
    onStatusChange('detecting');
    const working: ScanDetection[] = [...detections];
    const newTowers: ScanDetection[] = [];
    for (let i = 0; i < screenshots.length; i++) {
      if (shouldStopRef.current) break;
      const shot = screenshots[i];
      if (working.some(d => d.screenshotFilename === shot.filename)) continue;
      try {
        const det = await runDetection(shot);
        working.push(det);
        if (det.hasCoolingTower) newTowers.push(det);
        onDetectionsUpdate([...working]);
      } catch (err) {
        working.push(makeErrorDet(shot, err));
        onDetectionsUpdate([...working]);
      }
    }
    setIsDetecting(false);
    if (!shouldStopRef.current) {
      setShowBanner(true);
      onStatusChange('complete');
      await handlePostDetection(newTowers);
    } else {
      onStatusChange('idle');
    }
  }, [screenshots, detections, runDetection, makeErrorDet, onDetectionsUpdate, onStatusChange, handlePostDetection]);

  const handleStop = useCallback(() => {
    shouldStopRef.current = true;
  }, []);

  // ── handleRedetect ────────────────────────────────────────────────────────

  const handleRedetect = useCallback(async (detection: ScanDetection) => {
    const shot = screenshots.find(s => s.filename === detection.screenshotFilename);
    if (!shot) return;
    if (shot.screenshotId) await clearDetectionResults(shot.screenshotId);
    const without = detections.filter(d => d.screenshotFilename !== shot.filename);
    onDetectionsUpdate(without);
    try {
      const det = await runDetection(shot);
      const updated = [...without, det];
      onDetectionsUpdate(updated);
      if (det.hasCoolingTower) await handlePostDetection([det]);
    } catch (err) {
      onDetectionsUpdate([...without, makeErrorDet(shot, err)]);
    }
  }, [screenshots, detections, runDetection, makeErrorDet, onDetectionsUpdate, handlePostDetection]);

  // ── handleBatchDetect ─────────────────────────────────────────────────────

  const handleBatchDetect = useCallback(async () => {
    const targets = screenshots.filter(s => selected.has(s.filename));
    if (targets.length === 0) return;
    setIsDetecting(true);
    shouldStopRef.current = false;
    onStatusChange('detecting');
    const working: ScanDetection[] = [...detections];
    const newTowers: ScanDetection[] = [];
    for (const shot of targets) {
      if (shouldStopRef.current) break;
      const without = working.filter(d => d.screenshotFilename !== shot.filename);
      try {
        const det = await runDetection(shot);
        const idx = working.findIndex(d => d.screenshotFilename === shot.filename);
        if (idx >= 0) working[idx] = det; else working.push(det);
        if (det.hasCoolingTower) newTowers.push(det);
        onDetectionsUpdate([...working]);
      } catch (err) {
        const errDet = makeErrorDet(shot, err);
        const idx = working.findIndex(d => d.screenshotFilename === shot.filename);
        if (idx >= 0) working[idx] = errDet; else working.push(errDet);
        onDetectionsUpdate([...working]);
      }
    }
    setIsDetecting(false);
    onStatusChange(shouldStopRef.current ? 'idle' : 'complete');
    if (!shouldStopRef.current) await handlePostDetection(newTowers);
  }, [screenshots, selected, detections, runDetection, makeErrorDet, onDetectionsUpdate, onStatusChange, handlePostDetection]);

  // ── handleBatchUpload ─────────────────────────────────────────────────────

  const handleBatchUpload = useCallback(async () => {
    const targets = detections.filter(
      d => selected.has(d.screenshotFilename) && d.hasCoolingTower
    );
    await uploadAllAnnotated(targets, updateDetection);
  }, [detections, selected, uploadAllAnnotated, updateDetection]);

  // ── selection handlers ────────────────────────────────────────────────────

  const handleSelect = useCallback((filename: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(filename); else next.delete(filename);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((filenames: string[]) => {
    setSelected(new Set(filenames));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  // ── review handlers ───────────────────────────────────────────────────────

  const handleOpenReview = useCallback((detection: ScanDetection) => {
    const idx = detections.findIndex(d => d.screenshotFilename === detection.screenshotFilename);
    if (idx >= 0) setReviewIndex(idx);
  }, [detections]);

  const handleReview = useCallback((filename: string, status: 'confirmed' | 'rejected') => {
    updateDetection(filename, { reviewStatus: status });
  }, [updateDetection]);

  const handleLinkEnterprise = useCallback((detection: ScanDetection) => {
    setMatchTarget(detection);
  }, []);

  // ── enterprise match confirm ──────────────────────────────────────────────

  const handleConfirmMatch = useCallback(async (detection: ScanDetection, enterpriseId: string) => {
    await confirmMatch(detection, enterpriseId, updateDetection);
    setMatchTarget(null);
  }, [confirmMatch, updateDetection]);

  // ── derived stats ─────────────────────────────────────────────────────────

  const confirmedCount = detections.filter(
    d => d.hasCoolingTower && d.confidence >= conf
  ).length;
  const suspiciousCount = detections.filter(
    d => d.hasCoolingTower && d.confidence >= 0.1 && d.confidence < conf
  ).length;
  const noTowerCount = detections.filter(
    d => !d.hasCoolingTower && !d.error
  ).length;
  const totalTowers = detections.reduce((sum, d) => sum + d.count, 0);

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
    <div className="flex flex-col h-full">

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radar className="w-4 h-4 text-cyan-400" />
            AI 冷却塔识别
          </h2>
          {/* Three-category summary pills */}
          {detections.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-900/60 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                确认 {confirmedCount}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-900/60 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                疑似 {suspiciousCount}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-700/80 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                无塔 {noTowerCount}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDetecting && (
            <span className="text-xs text-slate-400">
              {detections.length} / {screenshots.length}
            </span>
          )}
          <button
            onClick={() => setShowSettings(s => !s)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="检测服务设置"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          {!isDetecting ? (
            <button
              onClick={handleDetect}
              disabled={screenshots.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              开始识别
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              停止
            </button>
          )}
        </div>
      </div>

      {/* Completion banner */}
      {showBanner && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-emerald-700/60 to-emerald-600/40 border-b border-emerald-500/30 text-sm">
          <div className="flex items-center gap-3 text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span>识别完成 · 共 {screenshots.length} 张 · 发现冷却塔 {confirmedCount + suspiciousCount} 处 · 共 {totalTowers} 个</span>
          </div>
          <button onClick={() => setShowBanner(false)} className="text-emerald-300 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="flex-shrink-0 px-4 py-3 bg-slate-800/80 border-b border-slate-700 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">API 地址</label>
            <input
              type="text"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveApiUrl()}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleCheckHealth}
              className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              检测
            </button>
            <button
              onClick={handleSaveApiUrl}
              className="px-2 py-1 text-xs rounded bg-cyan-700 hover:bg-cyan-600 text-white transition-colors"
            >
              保存
            </button>
            {apiHealthy !== null && (
              <span className={`text-xs ${apiHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                {apiHealthy ? '● 正常' : '● 异常'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-20 shrink-0">
              置信度阈值 <span className="text-white">{conf.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.1} max={0.9} step={0.05}
              value={conf}
              onChange={e => handleConfChange(parseFloat(e.target.value))}
              className="flex-1 accent-cyan-500"
            />
          </div>
        </div>
      )}

      {/* Filter bar */}
      <DetectionFilterBar
        filters={filters}
        onChange={setFilters}
        detections={detections}
      />

      {/* Screenshot grid */}
      <div className="flex-1 overflow-y-auto">
        <ScreenshotGrid
          screenshots={screenshots}
          detections={filteredDetections}
          selected={selected}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onReview={handleOpenReview}
          confThreshold={conf}
        />
      </div>

      {/* Floating action bar */}
      <FloatingActionBar
        selectedCount={selected.size}
        onDetect={handleBatchDetect}
        onUpload={handleBatchUpload}
        onDelete={() => {
          const without = detections.filter(d => !selected.has(d.screenshotFilename));
          onDetectionsUpdate(without);
          setSelected(new Set());
        }}
        onLinkEnterprise={() => {
          const first = detections.find(d => selected.has(d.screenshotFilename) && d.hasCoolingTower);
          if (first) setMatchTarget(first);
        }}
        isDetecting={isDetecting}
      />

      {/* Review modal */}
      {reviewIndex !== null && (
        <ReviewModal
          detections={detections}
          initialIndex={reviewIndex}
          onClose={() => setReviewIndex(null)}
          onReview={handleReview}
          onRedetect={handleRedetect}
          onLinkEnterprise={handleLinkEnterprise}
        />
      )}

      {/* Enterprise match modal */}
      {matchTarget !== null && (
        <EnterpriseMatchModal
          detection={matchTarget}
          onClose={() => setMatchTarget(null)}
          onConfirm={handleConfirmMatch}
        />
      )}
    </div>
  );
}

