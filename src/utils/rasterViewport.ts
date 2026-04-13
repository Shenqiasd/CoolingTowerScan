export const SATELLITE_SOURCE_TILE_SIZE = 256;
export const MAPBOX_VIEWPORT_TILE_SIZE = 512;

export interface ViewportPixelSource {
  width: number;
  height: number;
  clientWidth?: number;
  clientHeight?: number;
}

export function getViewportPixelSize(source: ViewportPixelSource): { width: number; height: number } {
  const width = source.clientWidth && source.clientWidth > 0 ? source.clientWidth : source.width;
  const height = source.clientHeight && source.clientHeight > 0 ? source.clientHeight : source.height;
  return { width, height };
}

export function viewSpanAtZoom(
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  centerLat: number,
): { spanLng: number; spanLat: number } {
  const earthCircumference = 40075016.686;
  const metersPerPixel = earthCircumference / (MAPBOX_VIEWPORT_TILE_SIZE * Math.pow(2, zoom));
  const widthMeters = canvasWidth * metersPerPixel;
  const heightMeters = canvasHeight * metersPerPixel;
  const spanLng = widthMeters / (111320 * Math.cos((centerLat * Math.PI) / 180));
  const spanLat = heightMeters / 111320;
  return { spanLng, spanLat };
}

export function autoZoomForRadius(
  radiusM: number,
  canvasWidth: number,
  centerLat: number,
): number {
  const earthCircumference = 40075016.686;
  const targetSpanMeters = radiusM * 2 * 1.2;
  const zoom = Math.log2(
    (earthCircumference * Math.cos((centerLat * Math.PI) / 180)) /
    (targetSpanMeters * (canvasWidth / MAPBOX_VIEWPORT_TILE_SIZE)),
  );
  return Math.min(Math.floor(zoom), 18);
}
