import { MAPBOX_VIEWPORT_TILE_SIZE } from './rasterViewport.ts';

const MAX_MERCATOR_LAT = 85.05112878;
const EARTH_CIRCUMFERENCE_METERS = 40075016.686;

export interface WorldPixelPoint {
  x: number;
  y: number;
}

export interface LngLatPoint {
  lng: number;
  lat: number;
}

export function projectLngLatToWorldPixels(
  lng: number,
  lat: number,
  zoom: number,
): WorldPixelPoint {
  const worldSize = MAPBOX_VIEWPORT_TILE_SIZE * (2 ** zoom);
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
  };
}

export function unprojectWorldPixelsToLngLat(
  x: number,
  y: number,
  zoom: number,
): LngLatPoint {
  const worldSize = MAPBOX_VIEWPORT_TILE_SIZE * (2 ** zoom);
  const lng = (x / worldSize) * 360 - 180;
  const mercatorY = 0.5 - y / worldSize;
  const lat = (Math.atan(Math.sinh(mercatorY * 2 * Math.PI)) * 180) / Math.PI;
  return { lng, lat };
}

export function metersPerWorldPixelAtLat(zoom: number, lat: number): number {
  return (
    EARTH_CIRCUMFERENCE_METERS
    * Math.cos((lat * Math.PI) / 180)
  ) / (MAPBOX_VIEWPORT_TILE_SIZE * (2 ** zoom));
}
