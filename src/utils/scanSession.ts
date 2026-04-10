import type { ScanSession, ScreenshotResult } from '../types/pipeline.ts';

export function applyScreenshotsReady(
  prev: ScanSession,
  screenshots: ScreenshotResult[],
): ScanSession {
  return {
    ...prev,
    screenshots,
    detections: [],
    status: 'screenshotting',
  };
}
