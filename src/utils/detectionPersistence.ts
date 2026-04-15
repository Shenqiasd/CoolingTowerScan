import { supabase } from '../lib/supabase';
import type { DetectionApiResult } from './detectionApi';
import { createEnterpriseHvacRepo, recomputeEnterpriseHvac } from './enterpriseHvac.ts';
import {
  createScanCandidateRepo,
  materializeScanCandidateForDetection,
  type ScanCandidateScreenshotContext,
  type StoredDetectionRow,
} from './scanCandidateRepo.ts';

async function loadScreenshotContext(screenshotId: string): Promise<ScanCandidateScreenshotContext | null> {
  const { data, error } = await supabase
    .from('scan_screenshots')
    .select(`
      id,
      session_id,
      enterprise_id,
      filename,
      storage_url,
      lng,
      lat,
      address_label,
      resolved_address
    `)
    .eq('id', screenshotId)
    .maybeSingle();

  if (error || !data?.session_id) {
    return null;
  }

  return {
    screenshotId: data.id,
    sessionId: data.session_id,
    enterpriseId: data.enterprise_id ?? null,
    filename: data.filename,
    source: data.address_label ? 'address' : 'area',
    addressLabel: data.address_label,
    resolvedAddress: data.resolved_address,
    lng: data.lng,
    lat: data.lat,
    storageUrl: data.storage_url,
  };
}

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
): Promise<void> {
  const status = result.has_cooling_tower ? 'detected' : 'no_result';
  const screenshot = await loadScreenshotContext(screenshotId);

  // 1. Update scan_screenshots
  await supabase.from('scan_screenshots').update({
    has_cooling_tower: result.has_cooling_tower,
    tower_count: result.count,
    max_confidence: result.confidence,
    detection_status: status,
  }).eq('id', screenshotId);

  // 2. Insert detection_results for each bbox
  let detectionRows: StoredDetectionRow[] = [];
  if (result.detections.length > 0) {
    const rows = result.detections.map((d, i) => ({
      screenshot_id: screenshotId,
      enterprise_id: enterpriseId ?? null,
      account_number: '',
      image_path: screenshotId,
      detection_id: i,
      confidence: d.confidence,
      class_name: d.class_name,
      bbox_x1: d.x1,
      bbox_y1: d.y1,
      bbox_x2: d.x2,
      bbox_y2: d.y2,
      center_x: d.center_x,
      center_y: d.center_y,
      bbox_width: d.width,
      bbox_height: d.height,
      bbox_area: d.width * d.height,
    }));
    const { data } = await supabase
      .from('detection_results')
      .insert(rows)
      .select('id, screenshot_id, confidence, bbox_area');
    detectionRows = (data ?? []) as StoredDetectionRow[];
  }

  // 3. Upsert scan_candidates for tower detections
  if (screenshot) {
    await materializeScanCandidateForDetection({
      repo: createScanCandidateRepo(supabase),
      screenshot: {
        ...screenshot,
        enterpriseId,
      },
      detectionResult: result,
      detectionRows,
    });
  }

  // 4. Update enterprise if linked
  if (enterpriseId) {
    await recomputeEnterpriseHvac(createEnterpriseHvacRepo(supabase), enterpriseId);
  }
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
