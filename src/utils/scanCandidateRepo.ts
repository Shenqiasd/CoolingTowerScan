import type { ScanCandidateStatus } from '../types/scanCandidate.ts';
import type { DetectionApiResult } from './detectionApi.ts';

export interface ScanCandidateScreenshotContext {
  screenshotId: string;
  sessionId: string;
  enterpriseId: string | null;
  filename: string;
  source: 'area' | 'address';
  addressLabel?: string | null;
  resolvedAddress?: string | null;
  lng: number;
  lat: number;
  storageUrl?: string | null;
}

export interface StoredDetectionRow {
  id: string;
  screenshot_id: string;
  confidence: number | null;
  bbox_area: number | null;
}

export interface ScanCandidateUpsertRow {
  candidate_code: string;
  scan_session_id: string;
  enterprise_id: string | null;
  site_id: null;
  status: ScanCandidateStatus;
  source_type: 'cooling_tower_scan';
  source_label: string;
  matched_enterprise_name: string;
  matched_address: string;
  cooling_tower_count: number;
  total_tower_area_m2: number;
  total_tower_bbox_area_px: number;
  estimated_capacity_rt: number;
  estimated_cooling_station_power_kw: number;
  confidence_score: number;
  review_note: string;
  rejection_reason: string;
  source_payload: Record<string, unknown>;
  hvac_estimate_snapshot: Record<string, unknown>;
  created_by: null;
}

export interface ScanCandidateEvidenceRow {
  candidate_id: string;
  screenshot_id: string;
  detection_result_id: string | null;
  kind: 'original' | 'bbox';
  sort_order: number;
  metadata: Record<string, unknown>;
}

export interface ScanCandidateRepo {
  upsertCandidate(row: ScanCandidateUpsertRow): Promise<{ id: string } | null>;
  replaceCandidateEvidences(candidateId: string, rows: ScanCandidateEvidenceRow[]): Promise<void>;
  deleteDetectionCandidate(screenshotId: string, sessionId: string, enterpriseId: string | null): Promise<void>;
}

export function buildCandidateCode(sessionId: string, screenshotId: string, enterpriseId: string | null): string {
  if (enterpriseId) {
    return `SC-${sessionId.slice(0, 8)}-${enterpriseId.slice(0, 8)}`;
  }

  return `SC-${sessionId.slice(0, 8)}-SS-${screenshotId.slice(0, 8)}`;
}

function resolveCandidateName(screenshot: ScanCandidateScreenshotContext): string {
  return screenshot.addressLabel?.trim() || screenshot.resolvedAddress?.trim() || screenshot.filename;
}

function resolveCandidateAddress(screenshot: ScanCandidateScreenshotContext): string {
  return screenshot.resolvedAddress?.trim() || screenshot.addressLabel?.trim() || screenshot.filename;
}

export function buildScanCandidateUpsert({
  screenshot,
  detectionResult,
}: {
  screenshot: ScanCandidateScreenshotContext;
  detectionResult: DetectionApiResult;
}): ScanCandidateUpsertRow | null {
  if (!detectionResult.has_cooling_tower || detectionResult.count <= 0) {
    return null;
  }

  return {
    candidate_code: buildCandidateCode(screenshot.sessionId, screenshot.screenshotId, screenshot.enterpriseId),
    scan_session_id: screenshot.sessionId,
    enterprise_id: screenshot.enterpriseId,
    site_id: null,
    status: 'under_review',
    source_type: 'cooling_tower_scan',
    source_label: screenshot.source === 'address' ? 'address_scan_detection' : 'area_scan_detection',
    matched_enterprise_name: resolveCandidateName(screenshot),
    matched_address: resolveCandidateAddress(screenshot),
    cooling_tower_count: detectionResult.count,
    total_tower_area_m2: 0,
    total_tower_bbox_area_px: 0,
    estimated_capacity_rt: 0,
    estimated_cooling_station_power_kw: 0,
    confidence_score: detectionResult.confidence,
    review_note: '',
    rejection_reason: '',
    source_payload: {
      screenshotId: screenshot.screenshotId,
      filename: screenshot.filename,
      source: screenshot.source,
      lng: screenshot.lng,
      lat: screenshot.lat,
      storageUrl: screenshot.storageUrl ?? null,
    },
    hvac_estimate_snapshot: {},
    created_by: null,
  };
}

export function buildScanCandidateEvidenceRows({
  candidateId,
  screenshotId,
  detectionRows,
}: {
  candidateId: string;
  screenshotId: string;
  detectionRows: StoredDetectionRow[];
}): ScanCandidateEvidenceRow[] {
  return [
    {
      candidate_id: candidateId,
      screenshot_id: screenshotId,
      detection_result_id: null,
      kind: 'original',
      sort_order: 0,
      metadata: {},
    },
    ...detectionRows.map((row, index) => ({
      candidate_id: candidateId,
      screenshot_id: screenshotId,
      detection_result_id: row.id,
      kind: 'bbox' as const,
      sort_order: index + 1,
      metadata: {
        confidence: row.confidence ?? 0,
        bboxArea: row.bbox_area ?? 0,
      },
    })),
  ];
}

export function createScanCandidateRepo(client: any): ScanCandidateRepo {
  return {
    async upsertCandidate(row) {
      const { data, error } = await client
        .from('scan_candidates')
        .upsert(row, { onConflict: 'candidate_code' })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data ?? null;
    },
    async replaceCandidateEvidences(candidateId, rows) {
      const { error: deleteError } = await client
        .from('scan_candidate_evidences')
        .delete()
        .eq('candidate_id', candidateId);
      if (deleteError) {
        throw deleteError;
      }

      if (rows.length === 0) {
        return;
      }

      const { error: insertError } = await client
        .from('scan_candidate_evidences')
        .insert(rows);
      if (insertError) {
        throw insertError;
      }
    },
    async deleteDetectionCandidate(screenshotId, sessionId, enterpriseId) {
      const candidateCode = buildCandidateCode(sessionId, screenshotId, enterpriseId);
      const { error } = await client
        .from('scan_candidates')
        .delete()
        .eq('candidate_code', candidateCode);
      if (error) {
        throw error;
      }
    },
  };
}

export async function findCandidateIdsByScreenshot(client: any, screenshotId: string): Promise<string[]> {
  const { data, error } = await client
    .from('scan_candidate_evidences')
    .select('candidate_id')
    .eq('screenshot_id', screenshotId);

  if (error) {
    throw error;
  }

  return [...new Set((data ?? []).map((row: { candidate_id: string | null }) => row.candidate_id).filter(Boolean))] as string[];
}

export async function updateScanCandidatesByScreenshot(
  client: any,
  screenshotId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const candidateIds = await findCandidateIdsByScreenshot(client, screenshotId);
  if (candidateIds.length === 0) {
    return;
  }

  const { error } = await client
    .from('scan_candidates')
    .update(updates)
    .in('id', candidateIds);

  if (error) {
    throw error;
  }
}

export async function materializeScanCandidateForDetection({
  repo,
  screenshot,
  detectionResult,
  detectionRows,
}: {
  repo: ScanCandidateRepo;
  screenshot: ScanCandidateScreenshotContext;
  detectionResult: DetectionApiResult;
  detectionRows: StoredDetectionRow[];
}): Promise<{ id: string } | null> {
  const candidate = buildScanCandidateUpsert({
    screenshot,
    detectionResult,
  });
  if (!candidate) {
    return null;
  }

  const saved = await repo.upsertCandidate(candidate);
  if (!saved) {
    return null;
  }

  await repo.replaceCandidateEvidences(
    saved.id,
    buildScanCandidateEvidenceRows({
      candidateId: saved.id,
      screenshotId: screenshot.screenshotId,
      detectionRows,
    }),
  );

  return saved;
}
