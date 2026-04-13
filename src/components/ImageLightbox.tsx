import { useEffect, useCallback, useState, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { warmImageSource } from '../utils/reviewImage';

interface LightboxImage {
  url: string;
  label: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const current = images[index];

  const resetTransform = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    resetTransform();
  }, [resetTransform]);

  const prev = useCallback(() => {
    goTo((index - 1 + images.length) % images.length);
  }, [index, images.length, goTo]);

  const next = useCallback(() => {
    goTo((index + 1) % images.length);
  }, [index, images.length, goTo]);

  const zoomIn = () => setScale(s => Math.min(s + 0.5, 5));
  const zoomOut = () => {
    setScale(s => {
      const next = Math.max(s - 0.5, 0.5);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && images.length > 1) prev();
      if (e.key === 'ArrowRight' && images.length > 1) next();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') resetTransform();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next, resetTransform, images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    warmImageSource(images[(index + 1) % images.length]?.url);
    warmImageSource(images[(index - 1 + images.length) % images.length]?.url);
  }, [images, index]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale(s => {
      const next = Math.min(Math.max(s + delta, 0.5), 5);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return Math.round(next * 10) / 10;
    });
  }

  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  }

  function onMouseUp() {
    setDragging(false);
    dragStart.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium text-sm">{current.label}</span>
          {images.length > 1 && (
            <span className="text-slate-400 text-xs">
              {index + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300
              hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetTransform}
            className="px-2 h-8 rounded-lg flex items-center justify-center text-slate-300
              hover:bg-white/10 transition-colors text-xs tabular-nums min-w-[3rem]"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 5}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300
              hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={resetTransform}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300
              hover:bg-white/10 transition-colors"
            title="重置"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300
              hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden select-none"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={current.url}
          alt={current.label}
          draggable={false}
          className="max-w-full max-h-full object-contain transition-transform duration-100"
          decoding="async"
          loading="eager"
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          }}
        />

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                bg-black/50 border border-white/10 flex items-center justify-center
                text-white hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                bg-black/50 border border-white/10 flex items-center justify-center
                text-white hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/10 flex-shrink-0">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all
                ${i === index ? 'border-cyan-400 opacity-100' : 'border-white/10 opacity-50 hover:opacity-75'}`}
            >
              <img
                src={img.url}
                alt={img.label}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}

      <div className="text-center pb-2 text-[10px] text-slate-600 flex-shrink-0">
        滚轮缩放 &middot; 拖拽移动 &middot; ESC 关闭
        {images.length > 1 && <> &middot; ← → 切换</>}
      </div>
    </div>
  );
}
