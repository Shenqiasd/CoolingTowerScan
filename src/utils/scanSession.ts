import type { ScanSession, ScreenshotResult } from '../types/pipeline.ts';

export function applyScreenshotsReady(
  prev: ScanSession,
  screenshots: ScreenshotResult[],
): ScanSession {
  return {
    ...prev,
    sessionId: screenshots[0]?.sessionId ?? null,
    screenshots,
    detections: [],
    status: 'screenshotting',
  };
}
