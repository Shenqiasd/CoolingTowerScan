import type { CaptureResult, ScanDetection } from '../types/pipeline.ts';
import type { PersistDetectionResultResponse } from '../api/detections.ts';
import type { DetectionApiResult } from './detectionApi.ts';

export function buildScanDetection(
  shot: CaptureResult,
  result: DetectionApiResult,
  persisted?: PersistDetectionResultResponse,
): ScanDetection {
  return {
    screenshotFilename: shot.filename,
    screenshotId: shot.screenshotId,
    lng: shot.lng,
    lat: shot.lat,
    source: shot.source,
    addressLabel: shot.addressLabel,
    resolvedAddress: shot.resolvedAddress,
    hasCoolingTower: result.has_cooling_tower,
    count: result.count,
    confidence: result.confidence,
    imageUrl: shot.publicUrl ?? shot.dataUrl ?? null,
    dataUrl: shot.dataUrl ?? null,
    publicUrl: shot.publicUrl,
    persistenceStatus: persisted ? 'saved' : undefined,
    candidateId: persisted?.candidateId ?? undefined,
    candidateStatus: persisted?.candidateStatus ?? undefined,
    enterpriseId: persisted?.enterpriseId ?? shot.enterpriseId ?? null,
    detections: result.detections.map((d) => ({
      class_name: d.class_name,
      confidence: d.confidence,
      x1: d.x1,
      y1: d.y1,
      x2: d.x2,
      y2: d.y2,
    })),
  };
}

export function buildErrorDetection(
  shot: CaptureResult,
  err: unknown,
): ScanDetection {
  return {
    screenshotFilename: shot.filename,
    screenshotId: shot.screenshotId,
    enterpriseId: shot.enterpriseId ?? null,
    lng: shot.lng,
    lat: shot.lat,
    source: shot.source,
    addressLabel: shot.addressLabel,
    resolvedAddress: shot.resolvedAddress,
    hasCoolingTower: false,
    count: 0,
    confidence: 0,
    imageUrl: shot.publicUrl ?? shot.dataUrl ?? null,
    dataUrl: shot.dataUrl ?? null,
    publicUrl: shot.publicUrl,
    error: err instanceof Error ? err.message : String(err),
    detections: [],
  };
}
