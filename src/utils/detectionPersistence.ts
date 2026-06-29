import { persistDetectionResult, type PersistDetectionResultResponse } from '../api/detections';
import { supabase } from '../lib/supabase';
import type { DetectionApiResult } from './detectionApi';
import { createEnterpriseHvacRepo, recomputeEnterpriseHvac } from './enterpriseHvac.ts';
import { createScanCandidateRepo } from './scanCandidateRepo.ts';

/**
 * 识别完成后写库：
 * 1. 更新 scan_screenshots 状态字段
 * 2. 批量 insert detection_results（含 bbox）
 * 3. 物化 scan_candidates / evidences
 * 4. 若有 enterprise_id 且检测到冷却塔，更新 enterprises
 */
export async function saveDetectionResult(
  screenshotId: string,
  enterpriseId: string | null,
  result: DetectionApiResult,
): Promise<PersistDetectionResultResponse> {
  return persistDetectionResult({ screenshotId, enterpriseId, result });
}

/** 重跑前清理旧识别结果 */
export async function clearDetectionResults(screenshotId: string): Promise<void> {
  const { data: screenshot } = await supabase
    .from('scan_screenshots')
    .select('session_id, enterprise_id')
    .eq('id', screenshotId)
    .maybeSingle();

  await supabase.from('detection_results').delete().eq('screenshot_id', screenshotId);
  if (screenshot?.session_id) {
    await createScanCandidateRepo(supabase).deleteDetectionCandidate(
      screenshotId,
      screenshot.session_id,
      screenshot.enterprise_id ?? null,
    );
  }
  await supabase.from('scan_screenshots').update({
    has_cooling_tower: false,
    tower_count: 0,
    max_confidence: 0,
    detection_status: 'pending',
  }).eq('id', screenshotId);

  if (screenshot?.enterprise_id) {
    await recomputeEnterpriseHvac(createEnterpriseHvacRepo(supabase), screenshot.enterprise_id);
  }
}
