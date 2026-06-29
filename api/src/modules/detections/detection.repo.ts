import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DetectionPersistenceRepo,
  PersistDetectionInput,
  PersistDetectionResult,
} from './detection.schemas.js';

function asPersistDetectionResult(value: unknown): PersistDetectionResult {
  const item = value as Partial<PersistDetectionResult> | null;
  if (!item || typeof item !== 'object') {
    throw new Error('persist_detection_result returned an invalid payload');
  }

  return {
    screenshotId: String(item.screenshotId ?? ''),
    status: item.status === 'detected' ? 'detected' : 'no_result',
    hasCoolingTower: Boolean(item.hasCoolingTower),
    count: Number(item.count ?? 0),
    confidence: Number(item.confidence ?? 0),
    enterpriseId: typeof item.enterpriseId === 'string' ? item.enterpriseId : null,
    candidateId: typeof item.candidateId === 'string' ? item.candidateId : null,
    candidateStatus: item.candidateStatus === 'approved' || item.candidateStatus === 'under_review'
      ? item.candidateStatus
      : null,
    detectionRowCount: Number(item.detectionRowCount ?? 0),
    evidenceCount: Number(item.evidenceCount ?? 0),
  };
}

export function createDetectionPersistenceRepo(
  supabaseAdmin: SupabaseClient,
): DetectionPersistenceRepo {
  return {
    async persistDetectionResult(input: PersistDetectionInput) {
      const { data, error } = await supabaseAdmin.rpc('persist_detection_result', {
        p_screenshot_id: input.screenshotId,
        p_enterprise_id: input.enterpriseId,
        p_result: input.result,
      });

      if (error) {
        throw error;
      }

      return asPersistDetectionResult(data);
    },
  };
}
