import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  RefreshCw, Link, Eye, EyeOff,
} from 'lucide-react';
import type { ScanDetection } from '../../types/pipeline';
import { supabase } from '../../lib/supabase';

interface Props {
  detections: ScanDetection[];
  initialIndex: number;
  onClose: () => void;
  onReview: (detection: ScanDetection, status: 'confirmed' | 'rejected') => void;
  onRedetect: (detection: ScanDetection) => void;
  onLinkEnterprise: (detection: ScanDetection) => void;
}

export default function ReviewModal({
  detections,
  initialIndex,
  onClose,
  onReview,
  onRedetect,
  onLinkEnterprise,
}: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [showBbox, setShowBbox] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const detection = detections[index];

  const imageSrc =
    detection?.annotatedUrl ||
    detection?.publicUrl ||
    detection?.dataUrl ||
    detection?.imageUrl ||
    '';

  // ── bbox drawing ─────────────────────────────────────────────────────────────

  const drawBoxes = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !detection) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showBbox) return;

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
  }, [detection, showBbox]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      drawBoxes();
    } else {
      img.addEventListener('load', drawBoxes);
      return () => img.removeEventListener('load', drawBoxes);
    }
  }, [drawBoxes, imageSrc]);

  // ── keyboard navigation ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(detections.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [detections.length, onClose]);

  // ── review action ─────────────────────────────────────────────────────────────

  const handleReview = useCallback(async (status: 'confirmed' | 'rejected') => {
    if (!detection || submitting) return;
    setSubmitting(true);
    try {
      if (detection.screenshotId) {
        await supabase
          .from('scan_screenshots')
          .update({ review_status: status })
          .eq('id', detection.screenshotId);
      }
      onReview(detection, status);
      setIndex(i => Math.min(detections.length - 1, i + 1));
    } finally {
      setSubmitting(false);
    }
  }, [detection, detections.length, onReview, submitting]);

  if (!detection) return null;

  const maxConf = detection.detections.length > 0
    ? Math.max(...detection.detections.map(d => d.confidence))
    : detection.confidence;

  const classNames = [...new Set(detection.detections.map(d => d.class_name))];

  const StatusBadge = () => {
    const s = detection.reviewStatus;
    if (s === 'confirmed') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 size={11} /> 已确认
      </span>
    );
    if (s === 'rejected') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30">
        <XCircle size={11} /> 已标记无塔
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
        待审核
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full h-full max-w-[1400px] flex rounded-xl overflow-hidden bg-slate-900 shadow-2xl">

        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* ── left panel: image (60%) ── */}
        <div className="relative flex-[6] bg-black flex flex-col">
          {/* image area */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {imageSrc ? (
              <>
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt={detection.screenshotFilename}
                  className="max-w-full max-h-full object-contain"
                  onLoad={drawBoxes}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ mixBlendMode: 'normal' }}
                />
              </>
            ) : (
              <div className="text-slate-500 text-sm">无图片</div>
            )}
          </div>

          {/* bottom bar: bbox toggle + nav */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900/80 border-t border-slate-700/50">
            <button
              onClick={() => setShowBbox(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              {showBbox ? <Eye size={13} /> : <EyeOff size={13} />}
              {showBbox ? '隐藏框选' : '显示框选'}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-400 min-w-[60px] text-center">
                {index + 1} / {detections.length}
              </span>
              <button
                onClick={() => setIndex(i => Math.min(detections.length - 1, i + 1))}
                disabled={index === detections.length - 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── right panel: details + actions (40%) ── */}
        <div className="flex-[4] flex flex-col bg-slate-800 border-l border-slate-700/50 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* header */}
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="text-sm font-medium text-white break-all leading-snug">
                  {detection.screenshotFilename}
                </h2>
                <StatusBadge />
              </div>
              <p className="text-xs text-slate-400">
                {detection.lat.toFixed(6)}, {detection.lng.toFixed(6)}
                {detection.addressLabel && (
                  <span className="ml-2 text-slate-500">· {detection.addressLabel}</span>
                )}
              </p>
            </div>

            {/* detection summary */}
            <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-4 space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">识别摘要</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">检测数量</p>
                  <p className="text-lg font-semibold text-white">{detection.count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">最高置信度</p>
                  <p className="text-lg font-semibold text-emerald-400">
                    {(maxConf * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              {classNames.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {classNames.map(cn => (
                    <span key={cn} className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                      {cn}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* bbox list */}
            {detection.detections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">检测框详情</p>
                {detection.detections.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-900/40 border border-slate-700/30 px-3 py-2"
                  >
                    <div className="text-xs text-slate-400">
                      <span className="text-slate-300 font-medium">{d.class_name}</span>
                      <span className="ml-2 text-slate-500">
                        {Math.round(d.x2 - d.x1)} × {Math.round(d.y2 - d.y1)} px
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400">
                      {(d.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── actions ── */}
          <div className="flex-shrink-0 p-4 border-t border-slate-700/50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleReview('confirmed')}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 size={15} />
                确认有塔
              </button>
              <button
                onClick={() => handleReview('rejected')}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle size={15} />
                标记无塔
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onRedetect(detection)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-amber-600/80 hover:bg-amber-500 text-white transition-colors"
              >
                <RefreshCw size={15} />
                重新识别
              </button>
              <button
                onClick={() => onLinkEnterprise(detection)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600/80 hover:bg-blue-500 text-white transition-colors"
              >
                <Link size={15} />
                关联企业
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
