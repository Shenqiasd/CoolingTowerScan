import type { CaptureResult, ScanDetection } from '../types/pipeline';

const warmedImageSources = new Set<string>();

export function getDetectionReviewImageSrc(detection?: ScanDetection | null): string {
  if (!detection) return '';
  return (
    detection.dataUrl ||
    detection.publicUrl ||
    detection.imageUrl ||
    detection.annotatedUrl ||
    ''
  );
}

export function getScreenshotPreviewImageSrc(
  screenshot: CaptureResult,
  detection?: ScanDetection,
): string {
  return (
    screenshot.dataUrl ||
    screenshot.publicUrl ||
    detection?.publicUrl ||
    detection?.dataUrl ||
    detection?.imageUrl ||
    detection?.annotatedUrl ||
    ''
  );
}

export function warmImageSource(src?: string | null) {
  if (!src || typeof Image === 'undefined' || warmedImageSources.has(src)) return;
  if (src.startsWith('data:')) return;

  warmedImageSources.add(src);

  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';

  const forget = () => {
    warmedImageSources.delete(src);
  };

  img.onerror = forget;
  img.src = src;

  if (typeof img.decode === 'function') {
    void img.decode().catch(forget);
  }
}
