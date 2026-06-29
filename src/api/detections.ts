import { ApiClientError, apiRequest } from './client';
import { supabase } from '../lib/supabase';
import type { DetectionApiResult } from '../utils/detectionApi';
import type { ScanCandidateStatus } from '../types/scanCandidate';

export interface PersistDetectionResultResponse {
  screenshotId: string;
  status: 'detected' | 'no_result';
  hasCoolingTower: boolean;
  count: number;
  confidence: number;
  enterpriseId: string | null;
  candidateId: string | null;
  candidateStatus: ScanCandidateStatus | null;
  detectionRowCount: number;
  evidenceCount: number;
}

export async function persistDetectionResult(input: {
  screenshotId: string;
  enterpriseId: string | null;
  result: DetectionApiResult;
}): Promise<PersistDetectionResultResponse> {
  try {
    const response = await apiRequest<{ result: PersistDetectionResultResponse }>('/v1/detections/persist', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.result;
  } catch (error) {
    const canFallbackToRpc = !(error instanceof ApiClientError)
      || error.code === 'API_BASE_URL_MISSING'
      || error.status === 404;
    if (!canFallbackToRpc) {
      throw error;
    }
  }

  const { data, error } = await supabase.rpc('persist_detection_result', {
    p_screenshot_id: input.screenshotId,
    p_enterprise_id: input.enterpriseId,
    p_result: input.result,
  });

  if (error) {
    throw error;
  }

  return data as PersistDetectionResultResponse;
}
