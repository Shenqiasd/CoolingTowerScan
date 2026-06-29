import assert from 'node:assert/strict';
import test from 'node:test';

import {
  metersPerWorldPixelAtLat,
  projectLngLatToWorldPixels,
  unprojectWorldPixelsToLngLat,
} from './mercatorPixels.ts';

test('world pixel projection round-trips lng/lat at capture zoom', () => {
  const source = { lng: 117.020621566492, lat: 31.9681894291755 };
  const projected = projectLngLatToWorldPixels(source.lng, source.lat, 18);
  const restored = unprojectWorldPixelsToLngLat(projected.x, projected.y, 18);

  assert.ok(Math.abs(restored.lng - source.lng) < 1e-12);
  assert.ok(Math.abs(restored.lat - source.lat) < 1e-12);
});

test('address grid pixel spacing preserves intended capture overlap', () => {
  const zoom = 18;
  const centerLat = 31.9681894291755;
  const center = projectLngLatToWorldPixels(117.020621566492, centerLat, zoom);
  const viewportWidth = 1280;
  const viewportHeight = 720;
  const overlapRatio = 0.1;
  const stepX = viewportWidth * (1 - overlapRatio);
  const stepY = viewportHeight * (1 - overlapRatio);
  const left = unprojectWorldPixelsToLngLat(center.x - stepX, center.y, zoom);
  const right = unprojectWorldPixelsToLngLat(center.x, center.y, zoom);
  const lower = unprojectWorldPixelsToLngLat(center.x, center.y + stepY, zoom);
  const leftProjected = projectLngLatToWorldPixels(left.lng, left.lat, zoom);
  const rightProjected = projectLngLatToWorldPixels(right.lng, right.lat, zoom);
  const lowerProjected = projectLngLatToWorldPixels(lower.lng, lower.lat, zoom);

  assert.ok(Math.abs((rightProjected.x - leftProjected.x) - stepX) < 1e-9);
  assert.ok(Math.abs((lowerProjected.y - rightProjected.y) - stepY) < 1e-9);

  const metersPerPixel = metersPerWorldPixelAtLat(zoom, centerLat);
  assert.ok(metersPerPixel > 0);
  assert.ok(metersPerPixel < 1);
});
