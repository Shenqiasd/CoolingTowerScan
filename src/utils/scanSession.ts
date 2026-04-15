import type { ScanSession, ScreenshotResult } from '../types/pipeline.ts';
import type { ScanTask } from '../types/scanTask.ts';

function buildTaskFromScreenshots(screenshots: ScreenshotResult[]): ScanTask | null {
  const first = screenshots[0];
  if (!first) {
    return null;
  }

  return {
    id: first.sessionId ?? null,
    mode: first.source ?? 'area',
    status: 'capturing',
    screenshotCount: screenshots.length,
    detectedCount: 0,
    reviewedCount: 0,
  };
}

export function applyScreenshotsReady(
  prev: ScanSession,
  screenshots: ScreenshotResult[],
): ScanSession {
  return {
    ...prev,
    sessionId: screenshots[0]?.sessionId ?? null,
    task: buildTaskFromScreenshots(screenshots),
    screenshots,
    detections: [],
    status: 'screenshotting',
  };
}
