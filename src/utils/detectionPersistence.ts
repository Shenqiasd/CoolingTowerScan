import { supabase } from '../lib/supabase';
import type { DetectionApiResult } from './detectionApi';
import { createEnterpriseHvacRepo, recomputeEnterpriseHvac } from './enterpriseHvac.ts';

/**
 * 识别完成后写库：
 * 1. 更新 scan_screenshots 状态字段
 * 2. 批量 insert detection_results（含 bbox）
 * 3. 若有 enterprise_id 且检测到冷却塔，更新 enterprises
 */
export async function saveDetectionResult(
  screenshotId: string,
  enterpriseId: string | null,
  result: DetectionApiResult,
): Promise<void> {
  const status = result.has_cooling_tower ? 'detected' : 'no_result';

  // 1. Update scan_screenshots
  await supabase.from('scan_screenshots').update({
    has_cooling_tower: result.has_cooling_tower,
    tower_count: result.count,
    max_confidence: result.confidence,
    detection_status: status,
  }).eq('id', screenshotId);

  // 2. Insert detection_results for each bbox
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
    await supabase.from('detection_results').insert(rows);
  }

  // 3. Update enterprise if linked
  if (enterpriseId) {
    await recomputeEnterpriseHvac(createEnterpriseHvacRepo(supabase), enterpriseId);
  }
}

/** 重跑前清理旧识别结果 */
export async function clearDetectionResults(screenshotId: string): Promise<void> {
  const { data: screenshot } = await supabase
    .from('scan_screenshots')
    .select('enterprise_id')
    .eq('id', screenshotId)
    .maybeSingle();

  await supabase.from('detection_results').delete().eq('screenshot_id', screenshotId);
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
