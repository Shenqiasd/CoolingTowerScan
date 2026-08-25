import { useState, useCallback, useRef } from 'react';
import { Radar, Play, Square, CheckCircle2, XCircle, Loader2, Settings2 } from 'lucide-react';
import type { ScreenshotResult } from './MapScreenshot';
import type { ScanDetection } from '../types/pipeline';
import { detectImage, getDetectionApiUrl, setDetectionApiUrl, checkHealth } from '../utils/detectionApi';

interface Props {
  screenshots: ScreenshotResult[];
  detections: ScanDetection[];
  onDetectionsUpdate: (detections: ScanDetection[]) => void;
  onStatusChange: (status: 'detecting' | 'complete' | 'idle') => void;
}

export default function DetectionPanel({ screenshots, detections, onDetectionsUpdate, onStatusChange }: Props) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [apiUrl, setApiUrl] = useState(getDetectionApiUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
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

  const startDetection = useCallback(async () => {
    if (screenshots.length === 0) return;

    setIsDetecting(true);
    shouldStopRef.current = false;
    onStatusChange('detecting');
    setProgress(0);

    const newDetections: ScanDetection[] = [...detections];

    for (let i = 0; i < screenshots.length; i++) {
      if (shouldStopRef.current) break;

      const shot = screenshots[i];
      // Skip already detected
      if (newDetections.some(d => d.screenshotFilename === shot.filename)) {
        setProgress(i + 1);
        continue;
      }

      try {
        const blob = await (await fetch(shot.dataUrl)).blob();
        const result = await detectImage(blob, shot.filename, apiUrl);

        newDetections.push({
          screenshotFilename: shot.filename,
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
        });

        onDetectionsUpdate([...newDetections]);
      } catch (err) {
        newDetections.push({
          screenshotFilename: shot.filename,
          lng: shot.lng,
          lat: shot.lat,
          hasCoolingTower: false,
          count: 0,
          confidence: 0,
          imageUrl: shot.publicUrl,
          detections: [],
        });
        onDetectionsUpdate([...newDetections]);
      }

      setProgress(i + 1);
    }

    setIsDetecting(false);
    onStatusChange('complete');
  }, [screenshots, detections, apiUrl, onDetectionsUpdate, onStatusChange]);

  const stopDetection = useCallback(() => {
    shouldStopRef.current = true;
  }, []);

  const detectedCount = detections.filter(d => d.hasCoolingTower).length;
  const totalTowers = detections.reduce((sum, d) => sum + d.count, 0);

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

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* 顶部控制栏 */}
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

      {/* API 设置面板 */}
      {showSettings && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 flex items-center gap-3 flex-shrink-0">
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
      )}

      {/* 进度条 */}
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

      {/* 截图网格 */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {screenshots.map((shot) => {
            const detection = detections.find(d => d.screenshotFilename === shot.filename);
            const hasResult = !!detection;
            const hasTower = detection?.hasCoolingTower ?? false;

            return (
              <div
                key={shot.filename}
                className={`relative rounded-lg overflow-hidden border transition-all ${
                  hasTower
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                    : hasResult
                    ? 'border-slate-700/40'
                    : 'border-slate-700/20'
                }`}
              >
                <img
                  src={shot.dataUrl}
                  alt={shot.filename}
                  className="w-full aspect-square object-cover"
                />

                {/* 状态标签 */}
                <div className="absolute top-1.5 right-1.5">
                  {hasResult ? (
                    hasTower ? (
                      <div className="flex items-center gap-1 bg-emerald-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {detection.count}个
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                        <XCircle className="w-3 h-3" />
                        无
                      </div>
                    )
                  ) : isDetecting ? (
                    <div className="bg-slate-800/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                    </div>
                  ) : null}
                </div>

                {/* 底部信息 */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white/70 truncate">
                    ({shot.lng.toFixed(4)}, {shot.lat.toFixed(4)})
                  </p>
                  {hasTower && detection && (
                    <p className="text-[10px] text-emerald-400">
                      置信度 {(detection.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部统计 */}
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
            <span className="text-white font-medium">{detections.length - detectedCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-slate-400">冷却塔总数</span>
            <span className="text-white font-medium">{totalTowers}</span>
          </div>
        </div>
      )}
    </div>
  );
}
