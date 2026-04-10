import type { ScanDetection } from '../types/pipeline.ts';
import { getScreenshotIdentity } from './screenshotIdentity.ts';

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
