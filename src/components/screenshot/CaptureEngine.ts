import mapboxgl from 'mapbox-gl';
import { supabase } from '../../lib/supabase.ts';
import { autoZoomForRadius, getViewportPixelSize, viewSpanAtZoom } from '../../utils/rasterViewport.ts';
import { SCREENSHOT_STORAGE_BUCKET } from '../../utils/storageBuckets.ts';
import { buildStitchedStoragePath } from '../../utils/storagePath.ts';
import { buildStitchLayout } from '../../utils/stitchLayout.ts';

export interface CaptureTask {
  row: number;
  col: number;
  lng: number;
  lat: number;
  addressLabel?: string;
  resolvedAddress?: string;
}

export interface CaptureResult {
  filename: string;
  dataUrl: string | null;
  publicUrl: string | null;
  screenshotId: string | null;   // scan_screenshots.id after DB insert
  sessionId: string | null;
  row: number;
  col: number;
  lng: number;
  lat: number;
  source: 'area' | 'address';
  addressLabel?: string;
  resolvedAddress?: string;
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
  skipUpload?: boolean;           // if true, skip Supabase upload & DB insert (for tile stitching)
  sessionId?: string | null;      // pass existing session id (for stitched flow)
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
): Promise<{ publicUrl: string | null; error: string | null }> {
  const { error } = await supabase.storage
    .from(SCREENSHOT_STORAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true });
  if (error) return { publicUrl: null, error: error.message };
  const { data } = supabase.storage.from(SCREENSHOT_STORAGE_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}

export async function runCapture(opts: CaptureOptions): Promise<CaptureResult[]> {
  const { map, tasks, zoomLevel, mode, label, enterpriseId, delayMs = 1500, skipUpload = false, onProgress, onLog, shouldStop } = opts;
  const log = onLog ?? (() => {});

  // Create scan_session record (skip if sessionId already provided or skipUpload)
  let sessionId: string | null = opts.sessionId ?? null;
  if (!skipUpload && !sessionId) {
    const { data: sessionData, error: sessionErr } = await supabase
      .from('scan_sessions')
      .insert({ mode, label: label || null, zoom_level: zoomLevel, total_count: tasks.length })
      .select('id')
      .single();
    if (sessionErr || !sessionData) {
      log(`创建扫描任务失败: ${sessionErr?.message}`, 'error');
    }
    sessionId = sessionData?.id ?? null;
  }

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

    if (skipUpload) {
      results.push({
        filename,
        dataUrl,
        publicUrl: null,
        screenshotId: null,
        sessionId,
        row: task.row,
        col: task.col,
        lng: task.lng,
        lat: task.lat,
        source: mode,
        addressLabel: task.addressLabel,
        resolvedAddress: task.resolvedAddress,
        enterpriseId: enterpriseId ?? null,
      });
      log(`[${i + 1}/${tasks.length}] 瓦片 R${task.row}C${task.col} 截图完成`, 'info');
      continue;
    }

    const storagePath = `${sessionId ?? 'nosession'}/${filename}`;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const { publicUrl, error: uploadError } = await uploadToStorage(blob, storagePath);
    if (uploadError) {
      log(`[${i + 1}/${tasks.length}] 上传失败: ${uploadError}`, 'error');
    }

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
        resolved_address: task.resolvedAddress ?? null,
      }).select('id').single();
      screenshotId = ssData?.id ?? null;
    }

    results.push({
      filename,
      dataUrl,
      publicUrl,
      screenshotId,
      sessionId,
      row: task.row,
      col: task.col,
      lng: task.lng,
      lat: task.lat,
      source: mode,
      addressLabel: task.addressLabel,
      resolvedAddress: task.resolvedAddress,
      enterpriseId: enterpriseId ?? null,
    });
    log(`[${i + 1}/${tasks.length}] ${filename} ${publicUrl ? '✓ 已上传' : '(上传失败)'}`, publicUrl ? 'success' : 'error');
  }

  onProgress?.(tasks.length, tasks.length, tasks[tasks.length - 1]);
  return results;
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
  const viewport = getViewportPixelSize(canvas);
  const z = zoom ?? map.getZoom();
  const { spanLng, spanLat } = viewSpanAtZoom(z, viewport.width, viewport.height, centerLat);
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

/** 地址搜索模式：每个地址只生成 1 个任务，zoom 自动适配半径 */
export function buildAddressTasks(
  map: mapboxgl.Map,
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  addressLabel: string,
  resolvedAddress?: string,
): CaptureTask[] {
  return [{ row: 0, col: 0, lng: centerLng, lat: centerLat, addressLabel, resolvedAddress }];
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

/**
 * 地址模式：根据中心点 + 半径 + zoom 18 生成地毯式瓦片任务
 * 返回 tasks 数组及网格尺寸（拼合时需要）
 */
export function buildAddressGridTasks(
  map: mapboxgl.Map,
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  addressLabel: string,
  resolvedAddress?: string,
  zoom = 18,
  overlapRatio = 0.1,
): { tasks: CaptureTask[]; gridCols: number; gridRows: number } {
  const canvas = map.getCanvas();
  const viewport = getViewportPixelSize(canvas);
  const { spanLng, spanLat } = viewSpanAtZoom(zoom, viewport.width, viewport.height, centerLat);

  // meters per tile (approximate, using center lat)
  const metersPerDegreeLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const tileWidthMeters = spanLng * metersPerDegreeLng;
  const tileHeightMeters = spanLat * 111320;

  const stepWidthMeters = tileWidthMeters * (1 - overlapRatio);
  const stepHeightMeters = tileHeightMeters * (1 - overlapRatio);

  // Number of tiles needed to cover diameter, rounded up to odd (center tile on center point)
  const colsNeeded = Math.max(1, Math.ceil((radiusMeters * 2) / stepWidthMeters));
  const rowsNeeded = Math.max(1, Math.ceil((radiusMeters * 2) / stepHeightMeters));
  const gridCols = colsNeeded % 2 === 0 ? colsNeeded + 1 : colsNeeded;
  const gridRows = rowsNeeded % 2 === 0 ? rowsNeeded + 1 : rowsNeeded;

  const halfCols = Math.floor(gridCols / 2);
  const halfRows = Math.floor(gridRows / 2);

  const stepLng = spanLng * (1 - overlapRatio);
  const stepLat = spanLat * (1 - overlapRatio);

  const tasks: CaptureTask[] = [];
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const lng = centerLng + (col - halfCols) * stepLng;
      const lat = centerLat - (row - halfRows) * stepLat;
      tasks.push({ row, col, lng, lat, addressLabel, resolvedAddress });
    }
  }

  return { tasks, gridCols, gridRows };
}

/** 估算地址模式瓦片数量（用于 UI 预览，不需要地图实例） */
export function estimateAddressGridCount(
  radiusMeters: number,
  zoom = 18,
  canvasWidth = 1280,
  canvasHeight = 720,
  centerLat = 30,
  overlapRatio = 0.1,
): { gridCols: number; gridRows: number; total: number } {
  const { spanLng, spanLat } = viewSpanAtZoom(zoom, canvasWidth, canvasHeight, centerLat);
  const metersPerDegreeLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const tileWidthMeters = spanLng * metersPerDegreeLng;
  const tileHeightMeters = spanLat * 111320;
  const stepWidthMeters = tileWidthMeters * (1 - overlapRatio);
  const stepHeightMeters = tileHeightMeters * (1 - overlapRatio);
  const colsNeeded = Math.max(1, Math.ceil((radiusMeters * 2) / stepWidthMeters));
  const rowsNeeded = Math.max(1, Math.ceil((radiusMeters * 2) / stepHeightMeters));
  const gridCols = colsNeeded % 2 === 0 ? colsNeeded + 1 : colsNeeded;
  const gridRows = rowsNeeded % 2 === 0 ? rowsNeeded + 1 : rowsNeeded;
  return { gridCols, gridRows, total: gridCols * gridRows };
}

/** 把多张瓦片 dataUrl 按 row/col 拼合成一张大图 Blob */
export async function stitchTiles(
  tiles: CaptureResult[],
  gridCols: number,
  gridRows: number,
  overlapRatio = 0,
): Promise<Blob> {
  const firstTileDataUrl = tiles[0]?.dataUrl;
  if (!firstTileDataUrl) {
    throw new Error('missing tile image data');
  }

  // Load first tile to get dimensions
  const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = firstTileDataUrl;
  });
  const tileW = firstImg.naturalWidth;
  const tileH = firstImg.naturalHeight;

  const canvas = document.createElement('canvas');
  const layout = buildStitchLayout({
    tileWidth: tileW,
    tileHeight: tileH,
    gridCols,
    gridRows,
    overlapRatio,
  });

  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d')!;

  await Promise.all(tiles.map(tile =>
    new Promise<void>((resolve, reject) => {
      if (!tile.dataUrl) {
        reject(new Error(`missing tile image data for ${tile.row},${tile.col}`));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const tileLayout = layout.tiles.find(
          (entry) => entry.row === tile.row && entry.col === tile.col,
        );
        if (!tileLayout) {
          reject(new Error(`missing stitch layout for tile ${tile.row},${tile.col}`));
          return;
        }
        ctx.drawImage(
          img,
          tileLayout.srcX,
          tileLayout.srcY,
          tileLayout.srcWidth,
          tileLayout.srcHeight,
          tileLayout.destX,
          tileLayout.destY,
          tileLayout.srcWidth,
          tileLayout.srcHeight,
        );
        resolve();
      };
      img.onerror = reject;
      img.src = tile.dataUrl;
    })
  ));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
  });
}

/** 地址模式完整流程：截多张瓦片 → 拼合 → 上传一张大图 → 返回单个 CaptureResult */
export async function runAddressCapture(opts: {
  map: mapboxgl.Map;
  centerLng: number;
  centerLat: number;
  radiusMeters: number;
  addressLabel: string;
  resolvedAddress?: string;
  zoomLevel?: number;
  overlapRatio?: number;
  enterpriseId?: string | null;
  delayMs?: number;
  onProgress?: (done: number, total: number) => void;
  onLog?: (msg: string, type: 'info' | 'success' | 'error') => void;
  shouldStop: () => boolean;
}): Promise<CaptureResult | null> {
  const {
    map, centerLng, centerLat, radiusMeters, addressLabel, resolvedAddress,
    zoomLevel = 18, overlapRatio = 0.1, enterpriseId = null,
    delayMs = 1500, onProgress, onLog, shouldStop,
  } = opts;
  const log = onLog ?? (() => {});

  const { tasks, gridCols, gridRows } = buildAddressGridTasks(
    map, centerLng, centerLat, radiusMeters, addressLabel, resolvedAddress, zoomLevel, overlapRatio
  );

  log(`开始截图：${gridRows}×${gridCols} = ${tasks.length} 张瓦片，zoom ${zoomLevel}`, 'info');

  // Create session for this address
  const { data: sessionData } = await supabase
    .from('scan_sessions')
    .insert({ mode: 'address', label: addressLabel, zoom_level: zoomLevel, total_count: 1 })
    .select('id')
    .single();
  const sessionId: string | null = sessionData?.id ?? null;

  // Capture all tiles (no upload, no DB insert)
  const tiles = await runCapture({
    map, tasks, zoomLevel, mode: 'address', label: addressLabel,
    enterpriseId, delayMs, skipUpload: true, sessionId,
    onProgress: (done, total) => onProgress?.(done, total),
    onLog, shouldStop,
  });

  if (tiles.length === 0 || shouldStop()) return null;

  log(`拼合 ${tiles.length} 张瓦片中...`, 'info');

  const stitchedBlob = await stitchTiles(tiles, gridCols, gridRows, overlapRatio);

  // Upload stitched image
  const safeLabel = addressLabel.slice(0, 20).replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `stitched_Z${zoomLevel}_${safeLabel}.png`;
  const storagePath = buildStitchedStoragePath(sessionId, zoomLevel);
  const { publicUrl, error: uploadError } = await uploadToStorage(stitchedBlob, storagePath);
  if (uploadError) {
    log(`拼合图上传失败: ${uploadError}`, 'error');
  }

  log(`拼合完成 (${gridCols}×${gridRows} → ${Math.round(stitchedBlob.size / 1024)}KB)，${publicUrl ? '✓ 已上传' : '上传失败'}`, publicUrl ? 'success' : 'error');

  // Insert single scan_screenshot record for the stitched image
  let screenshotId: string | null = null;
  if (sessionId) {
    const { data: ssData } = await supabase.from('scan_screenshots').insert({
      session_id: sessionId,
      enterprise_id: enterpriseId ?? null,
      filename,
      storage_url: publicUrl,
      lng: centerLng,
      lat: centerLat,
      row_idx: 0,
      col_idx: 0,
      address_label: addressLabel,
      resolved_address: resolvedAddress ?? null,
    }).select('id').single();
    screenshotId = ssData?.id ?? null;
  }

  const dataUrl = URL.createObjectURL(stitchedBlob);
  return {
    filename, dataUrl, publicUrl, screenshotId, sessionId,
    row: 0, col: 0, lng: centerLng, lat: centerLat,
    source: 'address', addressLabel, resolvedAddress, enterpriseId,
  };
}
