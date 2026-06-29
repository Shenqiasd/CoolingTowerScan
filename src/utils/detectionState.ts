import type { CaptureResult, ScanDetection } from '../types/pipeline.ts';
import { getScreenshotIdentity, isDetectionForScreenshot } from './screenshotIdentity.ts';

export function patchDetection(
  detections: ScanDetection[],
  target: ScanDetection,
  update: Partial<ScanDetection>,
): ScanDetection[] {
  const targetIdentity = getScreenshotIdentity(target);

  return detections.map((detection) => (
    getScreenshotIdentity(detection) === targetIdentity
      ? { ...detection, ...update }
      : detection
  ));
}

export function upsertDetection(
  detections: ScanDetection[],
  nextDetection: ScanDetection,
): ScanDetection[] {
  const nextIdentity = getScreenshotIdentity(nextDetection);
  let replaced = false;
  const deduped = detections.flatMap((detection) => {
    if (getScreenshotIdentity(detection) !== nextIdentity) {
      return [detection];
    }

    if (replaced) {
      return [];
    }

    replaced = true;
    return [nextDetection];
  });

  if (!replaced) {
    return [...deduped, nextDetection];
  }

  return deduped;
}

export function appendErrorDetectionIfMissing(
  detections: ScanDetection[],
  screenshot: CaptureResult,
  errorDetection: ScanDetection,
): ScanDetection[] {
  if (detections.some((detection) => isDetectionForScreenshot(detection, screenshot))) {
    return detections;
  }

  return [...detections, errorDetection];
}
