import type { CaptureResult, ScanDetection, ScanSession } from '../types/pipeline.ts';
import type { ScanCandidateStatus } from '../types/scanCandidate.ts';
import type { ScanTask } from '../types/scanTask.ts';

export interface PersistedScreenshotRow {
  id: string;
  session_id: string;
  enterprise_id: string | null;
  filename: string;
  storage_url: string | null;
  annotated_url: string | null;
  lng: number;
  lat: number;
  row_idx: number | null;
  col_idx: number | null;
  address_label: string | null;
  resolved_address: string | null;
  has_cooling_tower: boolean | null;
  tower_count: number | null;
  max_confidence: number | null;
  detection_status: 'pending' | 'detected' | 'no_result' | 'error';
  review_status: 'pending' | 'confirmed' | 'rejected' | null;
}

export interface PersistedDetectionRow {
  screenshot_id: string;
  confidence: number | null;
  class_name: string | null;
  bbox_x1: number | null;
  bbox_y1: number | null;
  bbox_x2: number | null;
  bbox_y2: number | null;
}

export interface PersistedCandidateRow {
  id: string;
  screenshot_id: string;
  status: ScanCandidateStatus;
}

interface BuildRestoredScanSessionInput {
  sessionId: string;
  mode: 'area' | 'address';
  screenshots: PersistedScreenshotRow[];
  candidateRows?: PersistedCandidateRow[];
  detectionRows: PersistedDetectionRow[];
}

function buildScreenshotSource(
  mode: 'area' | 'address',
  row: PersistedScreenshotRow,
): CaptureResult['source'] {
  if (row.address_label) {
    return 'address';
  }

  return mode;
}

function buildRestoredStatus(
  screenshots: PersistedScreenshotRow[],
): ScanSession['status'] {
  if (screenshots.length === 0) {
    return 'idle';
  }

  const pendingCount = screenshots.filter((row) => row.detection_status === 'pending').length;
  if (pendingCount === screenshots.length) {
    return 'screenshotting';
  }
  if (pendingCount > 0) {
    return 'detecting';
  }

  return 'complete';
}

function buildTaskStatus(
  screenshots: PersistedScreenshotRow[],
  candidateRows: PersistedCandidateRow[],
): ScanTask['status'] {
  if (screenshots.length === 0) {
    return 'draft';
  }

  const pendingCount = screenshots.filter((row) => row.detection_status === 'pending').length;
  if (pendingCount === screenshots.length) {
    return 'capturing';
  }
  if (pendingCount > 0) {
    return 'detecting';
  }
  if (candidateRows.length > 0) {
    const hasOpenReview = candidateRows.some((row) => row.status === 'new' || row.status === 'under_review' || row.status === 'needs_info');
    return hasOpenReview ? 'review_pending' : 'completed';
  }

  return 'completed';
}

export function buildRestoredScanSession({
  sessionId,
  mode,
  screenshots,
  candidateRows = [],
  detectionRows,
}: BuildRestoredScanSessionInput): ScanSession {
  const detectionRowsByScreenshot = new Map<string, PersistedDetectionRow[]>();
  for (const row of detectionRows) {
    const items = detectionRowsByScreenshot.get(row.screenshot_id) ?? [];
    items.push(row);
    detectionRowsByScreenshot.set(row.screenshot_id, items);
  }
  const candidateByScreenshotId = new Map<string, PersistedCandidateRow>();
  for (const row of candidateRows) {
    candidateByScreenshotId.set(row.screenshot_id, row);
  }

  const restoredScreenshots: CaptureResult[] = screenshots.map((row) => ({
    filename: row.filename,
    dataUrl: null,
    publicUrl: row.storage_url,
    screenshotId: row.id,
    sessionId: row.session_id,
    row: row.row_idx ?? 0,
    col: row.col_idx ?? 0,
    lng: row.lng,
    lat: row.lat,
    source: buildScreenshotSource(mode, row),
    addressLabel: row.address_label ?? undefined,
    resolvedAddress: row.resolved_address ?? undefined,
    enterpriseId: row.enterprise_id,
  }));

  const restoredDetections: ScanDetection[] = screenshots
    .filter((row) => row.detection_status !== 'pending')
    .map((row) => {
      const rows = detectionRowsByScreenshot.get(row.id) ?? [];
      const candidate = candidateByScreenshotId.get(row.id);
      const confidence = row.max_confidence ?? Math.max(0, ...rows.map((item) => item.confidence ?? 0));

      return {
        screenshotFilename: row.filename,
        screenshotId: row.id,
        enterpriseId: row.enterprise_id,
        lng: row.lng,
        lat: row.lat,
        source: buildScreenshotSource(mode, row),
        addressLabel: row.address_label ?? undefined,
        resolvedAddress: row.resolved_address ?? undefined,
        hasCoolingTower: row.detection_status === 'detected',
        count: row.tower_count ?? rows.length,
        confidence,
        imageUrl: row.storage_url ?? row.annotated_url,
        dataUrl: null,
        publicUrl: row.storage_url,
        annotatedUrl: row.annotated_url,
        uploadStatus: row.annotated_url ? 'done' : 'idle',
        reviewStatus: row.review_status ?? 'pending',
        candidateId: candidate?.id ?? null,
        candidateStatus: candidate?.status ?? null,
        error: row.detection_status === 'error' ? 'Detection failed' : undefined,
        detections: rows.map((item) => ({
          class_name: item.class_name ?? 'cooling_tower',
          confidence: item.confidence ?? 0,
          x1: item.bbox_x1 ?? 0,
          y1: item.bbox_y1 ?? 0,
          x2: item.bbox_x2 ?? 0,
          y2: item.bbox_y2 ?? 0,
        })),
      };
    });

  const reviewedCount = restoredDetections.filter((row) => row.reviewStatus && row.reviewStatus !== 'pending').length;
  const task: ScanTask | null = screenshots.length > 0
    ? {
        id: sessionId,
        mode,
        status: buildTaskStatus(screenshots, candidateRows),
        screenshotCount: restoredScreenshots.length,
        detectedCount: restoredDetections.length,
        reviewedCount,
      }
    : null;

  return {
    sessionId,
    task,
    screenshots: restoredScreenshots,
    detections: restoredDetections,
    status: buildRestoredStatus(screenshots),
  };
}
