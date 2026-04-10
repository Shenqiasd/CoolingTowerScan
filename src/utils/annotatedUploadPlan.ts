import type { ScanDetection } from '../types/pipeline.ts';
import { getScreenshotIdentity } from './screenshotIdentity.ts';

export interface AnnotatedUploadPlan {
  ready: ScanDetection[];
  missingImage: ScanDetection[];
  missingBoxes: ScanDetection[];
  alreadyUploaded: ScanDetection[];
  noTower: ScanDetection[];
}

function hasImageSource(detection: ScanDetection): boolean {
  return Boolean(detection.dataUrl || detection.imageUrl || detection.publicUrl);
}

export function buildAnnotatedUploadPlan(
  detections: ScanDetection[],
  selectedIds: Set<string>,
): AnnotatedUploadPlan {
  const plan: AnnotatedUploadPlan = {
    ready: [],
    missingImage: [],
    missingBoxes: [],
    alreadyUploaded: [],
    noTower: [],
  };

  for (const detection of detections) {
    if (!selectedIds.has(getScreenshotIdentity(detection))) {
      continue;
    }

    if (!detection.hasCoolingTower) {
      plan.noTower.push(detection);
      continue;
    }

    if (detection.annotatedUrl) {
      plan.alreadyUploaded.push(detection);
      continue;
    }

    if (detection.detections.length === 0) {
      plan.missingBoxes.push(detection);
      continue;
    }

    if (!hasImageSource(detection)) {
      plan.missingImage.push(detection);
      continue;
    }

    plan.ready.push(detection);
  }

  return plan;
}
