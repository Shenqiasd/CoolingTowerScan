import type { ScanDetection } from '../types/pipeline.ts';
import { getScreenshotIdentity } from './screenshotIdentity.ts';

export interface AnnotatedUploadPlan {
  ready: ScanDetection[];
  needsReview: ScanDetection[];
  needsBinding: ScanDetection[];
  missingImage: ScanDetection[];
  missingBoxes: ScanDetection[];
  alreadyUploaded: ScanDetection[];
  noTower: ScanDetection[];
}

function hasImageSource(detection: ScanDetection): boolean {
  return Boolean(detection.dataUrl || detection.imageUrl || detection.publicUrl);
}

function isApprovedForAreaUpload(detection: ScanDetection): boolean {
  return Boolean(
    detection.reviewStatus === 'confirmed'
    || detection.candidateStatus === 'approved'
    || detection.candidateStatus === 'converted',
  );
}

function hasLinkedEnterprise(detection: ScanDetection): boolean {
  return Boolean(detection.enterpriseId || detection.matchedEnterpriseId);
}

export function isDetectionReadyForAnnotatedUpload(detection: ScanDetection): boolean {
  if (!detection.hasCoolingTower || detection.annotatedUrl) {
    return false;
  }

  if (!detection.detections.length || !hasImageSource(detection)) {
    return false;
  }

  if (detection.source === 'area') {
    return isApprovedForAreaUpload(detection) && hasLinkedEnterprise(detection);
  }

  return true;
}

export function buildAnnotatedUploadPlan(
  detections: ScanDetection[],
  selectedIds: Set<string>,
): AnnotatedUploadPlan {
  const plan: AnnotatedUploadPlan = {
    ready: [],
    needsReview: [],
    needsBinding: [],
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

    if (detection.source === 'area' && !isApprovedForAreaUpload(detection)) {
      plan.needsReview.push(detection);
      continue;
    }

    if (detection.source === 'area' && !hasLinkedEnterprise(detection)) {
      plan.needsBinding.push(detection);
      continue;
    }

    plan.ready.push(detection);
  }

  return plan;
}
