import mapboxgl from 'mapbox-gl';
import { supabase } from '../../lib/supabase';

export interface CaptureTask {
  row: number;
  col: number;
  lng: number;
  lat: number;
  addressLabel?: string;
}

export interface CaptureResult {
  filename: string;
  dataUrl: string;
  publicUrl: string | null;
  screenshotId: string | null;   // scan_screenshots.id after DB insert
  row: number;
  col: number;
  lng: number;
  lat: number;
  addressLabel?: string;
  enterpriseId?: string | null;
}

export interface CaptureOptions {
  map: mapboxgl.Map;
  tasks: CaptureTask[];
  zoomLevel: number;
  mode: 'area' | 'address';
  label?: string;
  enterpriseId?: string | null;
  delayMs?: number;
  onProgress?: (done: number, total: number, current: CaptureTask) => void;
  onLog?: (msg: string, type: 'info' | 'success' | 'error') => void;
  shouldStop: () => boolean;
}

function waitForMapIdle(map: mapboxgl.Map, timeout = 8000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (map.isStyleLoaded() && map.areTilesLoaded()) {
        // Extra frame buffer so GPU has flushed to canvas
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        return;
      }
      if (Date.now() - start > timeout) { resolve(); return; }
      setTimeout(check, 100);
    };
    // jumpTo is synchronous but tile loading is async — start checking next tick
    setTimeout(check, 50);
  });
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function uploadToStorage(
  blob: Blob,
  path: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from('scan-screenshots')
    .upload(path, blob, { contentType: 'image/png', upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('scan-screenshots').getPublicUrl(path);
  return data.publicUrl;
}

export async function runCapture(opts: CaptureOptions): Promise<CaptureResult[]> {
  const { map, tasks, zoomLevel, mode, label, enterpriseId, delayMs = 1500, onProgress, onLog, shouldStop } = opts;
  const log = onLog ?? (() => {});

  // Create scan_session record
  const { data: sessionData, error: sessionErr } = await supabase
    .from('scan_sessions')
    .insert({ mode, label: label || null, zoom_level: zoomLevel, total_count: tasks.length })
    .select('id')
    .single();

  if (sessionErr || !sessionData) {
    log(`创建扫描任务失败: ${sessionErr?.message}`, 'error');
  }
  const sessionId: string | null = sessionData?.id ?? null;

  const results: CaptureResult[] = [];

  for (let i = 0; i < tasks.length; i++) {
    if (shouldStop()) {
      log('截图任务已手动停止', 'error');
      break;
    }

    const task = tasks[i];
    onProgress?.(i, tasks.length, task);

    map.jumpTo({ center: [task.lng, task.lat], zoom: zoomLevel });
    await waitForMapIdle(map);
    await sleep(delayMs);

    const canvas = map.getCanvas();
    const dataUrl = canvas.toDataURL('image/png');

    const addrSuffix = task.addressLabel ? `_${task.addressLabel.slice(0, 20).replace(/[/\\?%*:|"<>]/g, '_')}` : '';
    const filename = `scan_R${task.row}_C${task.col}_Z${zoomLevel}${addrSuffix}.png`;
    const storagePath = `${sessionId ?? 'nosession'}/${filename}`;

    // Convert dataUrl to Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const publicUrl = await uploadToStorage(blob, storagePath);

    // Insert scan_screenshot record
    let screenshotId: string | null = null;
    if (sessionId) {
      const { data: ssData } = await supabase.from('scan_screenshots').insert({
        session_id: sessionId,
        enterprise_id: enterpriseId ?? null,
        filename,
        storage_url: publicUrl,
        lng: task.lng,
        lat: task.lat,
        row_idx: task.row,
        col_idx: task.col,
        address_label: task.addressLabel ?? null,
      }).select('id').single();
      screenshotId = ssData?.id ?? null;
    }

    results.push({ filename, dataUrl, publicUrl, screenshotId, row: task.row, col: task.col, lng: task.lng, lat: task.lat, addressLabel: task.addressLabel, enterpriseId: enterpriseId ?? null });
    log(`[${i + 1}/${tasks.length}] ${filename} ${publicUrl ? '✓ 已上传' : '(上传失败)'}`, publicUrl ? 'success' : 'error');
  }

  onProgress?.(tasks.length, tasks.length, tasks[tasks.length - 1]);
  return results;
}

/**
 * 根据 zoom 和画布尺寸计算单张截图覆盖的经纬度跨度（确定性，不依赖地图当前状态）
 * Mapbox 使用 Web Mercator，512px tile，zoom N 下每像素 = 地球周长 / (512 * 2^N)
 */
export function viewSpanAtZoom(
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  centerLat: number
): { spanLng: number; spanLat: number } {
  const earthCircumference = 40075016.686; // meters
  const metersPerPixel = earthCircumference / (512 * Math.pow(2, zoom));
  const widthMeters = canvasWidth * metersPerPixel;
  const heightMeters = canvasHeight * metersPerPixel;
  const spanLng = widthMeters / (111320 * Math.cos((centerLat * Math.PI) / 180));
  const spanLat = heightMeters / 111320;
  return { spanLng, spanLat };
}

/** 根据区域边界和 zoom 计算地毯式截图任务列表 */
export function buildAreaTasks(
  map: mapboxgl.Map,
  topLeftLng: number,
  topLeftLat: number,
  bottomRightLng: number,
  bottomRightLat: number,
  overlapRatio = 0.1,
  zoom?: number
): CaptureTask[] {
  const centerLat = (topLeftLat + bottomRightLat) / 2;
  const canvas = map.getCanvas();
  const z = zoom ?? map.getZoom();
  const { spanLng, spanLat } = viewSpanAtZoom(z, canvas.width, canvas.height, centerLat);
  const stepLng = spanLng * (1 - overlapRatio);
  const stepLat = spanLat * (1 - overlapRatio);

  const tasks: CaptureTask[] = [];
  let currentLat = topLeftLat - spanLat / 2;
  let row = 0;

  while (currentLat + spanLat / 2 >= bottomRightLat) {
    let currentLng = topLeftLng + spanLng / 2;
    let col = 0;
    while (currentLng - spanLng / 2 <= bottomRightLng) {
      tasks.push({ row, col, lng: currentLng, lat: currentLat });
      currentLng += stepLng;
      col++;
    }
    currentLat -= stepLat;
    row++;
  }

  return tasks;
}

/** 根据中心点和半径（米）计算单地址截图任务列表（地毯式） */
/** 根据半径自动计算合适的 zoom，使单张截图能覆盖整个直径范围（含 1.2x 边距） */
export function autoZoomForRadius(radiusM: number, canvasWidth: number, centerLat: number): number {
  const earthCircumference = 40075016.686;
  const targetSpanMeters = radiusM * 2 * 1.2;
  const zoom = Math.log2(
    (earthCircumference * Math.cos((centerLat * Math.PI) / 180)) /
    (targetSpanMeters * (canvasWidth / 512))
  );
  return Math.min(Math.floor(zoom), 18);
}

/** 地址搜索模式：每个地址只生成 1 个任务，zoom 自动适配半径 */
export function buildAddressTasks(
  map: mapboxgl.Map,
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  addressLabel: string,
): CaptureTask[] {
  return [{ row: 0, col: 0, lng: centerLng, lat: centerLat, addressLabel }];
}

/** 估算截图数量（不需要地图实例，用于预览） */
export function estimateTaskCount(
  viewSpanLng: number,
  viewSpanLat: number,
  topLeftLng: number,
  topLeftLat: number,
  bottomRightLng: number,
  bottomRightLat: number,
  overlapRatio = 0.1
): { rows: number; cols: number; total: number } {
  const stepLng = viewSpanLng * (1 - overlapRatio);
  const stepLat = viewSpanLat * (1 - overlapRatio);
  if (stepLng <= 0 || stepLat <= 0) return { rows: 0, cols: 0, total: 0 };
  const cols = Math.ceil((bottomRightLng - topLeftLng) / stepLng);
  const rows = Math.ceil((topLeftLat - bottomRightLat) / stepLat);
  return { rows: Math.max(1, rows), cols: Math.max(1, cols), total: Math.max(1, rows) * Math.max(1, cols) };
}
