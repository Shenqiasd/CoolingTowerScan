import { MAPBOX_VIEWPORT_TILE_SIZE } from './rasterViewport.ts';
import { calculateHVAC, type HvacResult } from './hvacCalculator.ts';

const EARTH_CIRCUMFERENCE_METERS = 40075016.686;

interface EnterpriseHvacEnterprise {
  id: string;
  industry_category: string;
  annotated_image_url?: string | null;
}

interface EnterpriseHvacDetection {
  screenshot_id: string | null;
  confidence: number;
  bbox_area: number;
}

interface EnterpriseHvacScreenshot {
  id: string;
  session_id: string | null;
  lat: number | null;
}

interface EnterpriseHvacSession {
  id: string;
  zoom_level: number | null;
}

export interface EnterpriseHvacRepo {
  getEnterprise(enterpriseId: string): Promise<EnterpriseHvacEnterprise | null>;
  listDetectionResults(enterpriseId: string): Promise<EnterpriseHvacDetection[]>;
  listScreenshots(screenshotIds: string[]): Promise<EnterpriseHvacScreenshot[]>;
  listSessions(sessionIds: string[]): Promise<EnterpriseHvacSession[]>;
  updateEnterprise(enterpriseId: string, values: Record<string, unknown>): Promise<void>;
}

export interface EnterpriseHvacPayload extends HvacResult {
  has_cooling_tower: boolean;
  cooling_tower_count: number;
  detection_confidence: number;
  detection_status: 'detected' | 'no_result';
}

export function estimateDetectionAreaM2(
  bboxAreaPx: number,
  zoomLevel: number,
  latitude: number,
): number {
  if (bboxAreaPx <= 0 || !Number.isFinite(zoomLevel) || !Number.isFinite(latitude)) {
    return 0;
  }

  const metersPerPixel = (
    EARTH_CIRCUMFERENCE_METERS * Math.cos((latitude * Math.PI) / 180)
  ) / (MAPBOX_VIEWPORT_TILE_SIZE * Math.pow(2, zoomLevel));

  return bboxAreaPx * metersPerPixel * metersPerPixel;
}

export function bboxAreaPixelsToSquareMeters(
  bboxAreaPx: number,
  zoomLevel: number,
  latitude: number,
): number {
  return estimateDetectionAreaM2(bboxAreaPx, zoomLevel, latitude);
}

export function summarizeScaledDetections(
  detections: Array<{ bboxArea: number; zoomLevel: number; lat: number }>,
): { count: number; totalAreaM2: number; avgAreaM2: number; maxAreaM2: number } {
  if (!detections.length) {
    return {
      count: 0,
      totalAreaM2: 0,
      avgAreaM2: 0,
      maxAreaM2: 0,
    };
  }

  const areas = detections.map((detection) =>
    estimateDetectionAreaM2(detection.bboxArea, detection.zoomLevel, detection.lat),
  );
  const totalAreaM2 = areas.reduce((sum, area) => sum + area, 0);
  const maxAreaM2 = areas.reduce((max, area) => Math.max(max, area), 0);

  return {
    count: detections.length,
    totalAreaM2,
    avgAreaM2: totalAreaM2 / detections.length,
    maxAreaM2,
  };
}

export async function recomputeEnterpriseHvac(
  repo: EnterpriseHvacRepo,
  enterpriseId: string,
): Promise<EnterpriseHvacPayload> {
  const enterprise = await repo.getEnterprise(enterpriseId);
  if (!enterprise) {
    throw new Error(`enterprise not found: ${enterpriseId}`);
  }

  const detections = await repo.listDetectionResults(enterpriseId);

  if (!detections.length) {
    const hvac = calculateHVAC(0, enterprise.industry_category);
    const payload = {
      has_cooling_tower: false,
      cooling_tower_count: 0,
      detection_confidence: 0,
      detection_status: 'no_result' as const,
      ...hvac,
    };
    await repo.updateEnterprise(enterpriseId, payload);
    return payload;
  }

  const screenshotIds = [...new Set(
    detections
      .map((detection) => detection.screenshot_id)
      .filter((id): id is string => Boolean(id)),
  )];
  const screenshots = await repo.listScreenshots(screenshotIds);
  const sessions = await repo.listSessions([
    ...new Set(
      screenshots
        .map((screenshot) => screenshot.session_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]);

  const screenshotById = new Map(screenshots.map((screenshot) => [screenshot.id, screenshot]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const areas = detections.map((detection) => {
    const screenshot = detection.screenshot_id ? screenshotById.get(detection.screenshot_id) : null;
    const session = screenshot?.session_id ? sessionById.get(screenshot.session_id) : null;
    if (!screenshot || !session?.zoom_level || screenshot.lat === null) {
      return 0;
    }

    return estimateDetectionAreaM2(detection.bbox_area, session.zoom_level, screenshot.lat);
  });

  const detectedTowerTotalAreaM2 = areas.reduce((sum, area) => sum + area, 0);
  const detectedTowerMaxAreaM2 = areas.reduce((max, area) => Math.max(max, area), 0);
  const detectedTowerAvgAreaM2 = areas.length ? detectedTowerTotalAreaM2 / areas.length : 0;
  const detectionConfidence = detections.reduce((max, detection) => Math.max(max, detection.confidence), 0);

  const hvac = calculateHVAC(detections.length, enterprise.industry_category, {
    detectedTowerTotalAreaM2,
    detectedTowerAvgAreaM2,
    detectedTowerMaxAreaM2,
  });
  const detectionStatus: EnterpriseHvacPayload['detection_status'] =
    detections.length > 0 ? 'detected' : 'no_result';

  const payload = {
    has_cooling_tower: detections.length > 0,
    cooling_tower_count: detections.length,
    detection_confidence: detectionConfidence,
    detection_status: detectionStatus,
    ...hvac,
  };

  await repo.updateEnterprise(enterpriseId, payload);
  return payload;
}

export function createEnterpriseHvacRepo(client: any): EnterpriseHvacRepo {
  return {
    async getEnterprise(enterpriseId) {
      const { data, error } = await client
        .from('enterprises')
        .select('id, industry_category, annotated_image_url')
        .eq('id', enterpriseId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
    async listDetectionResults(enterpriseId) {
      const { data, error } = await client
        .from('detection_results')
        .select('screenshot_id, confidence, bbox_area')
        .eq('enterprise_id', enterpriseId)
        .order('detection_id', { ascending: true });
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    async listScreenshots(screenshotIds) {
      if (!screenshotIds.length) {
        return [];
      }
      const { data, error } = await client
        .from('scan_screenshots')
        .select('id, session_id, lat')
        .in('id', screenshotIds);
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    async listSessions(sessionIds) {
      if (!sessionIds.length) {
        return [];
      }
      const { data, error } = await client
        .from('scan_sessions')
        .select('id, zoom_level')
        .in('id', sessionIds);
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    async updateEnterprise(enterpriseId, values) {
      const { error } = await client
        .from('enterprises')
        .update(values)
        .eq('id', enterpriseId);
      if (error) {
        throw error;
      }
    },
  };
}
