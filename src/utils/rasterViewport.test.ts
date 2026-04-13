import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAPBOX_VIEWPORT_TILE_SIZE,
  SATELLITE_SOURCE_TILE_SIZE,
  getViewportPixelSize,
  viewSpanAtZoom,
} from './rasterViewport.ts';

test('viewSpanAtZoom matches Mapbox GL viewport zoom semantics', () => {
  const span = viewSpanAtZoom(18, 1280, 720, 31.9681894291755);

  assert.equal(SATELLITE_SOURCE_TILE_SIZE, 256);
  assert.equal(MAPBOX_VIEWPORT_TILE_SIZE, 512);
  assert.ok(Math.abs(span.spanLng - 0.0040469658717750695) < 1e-12);
  assert.ok(Math.abs(span.spanLat - 0.0019311816569737637) < 1e-12);
});

test('getViewportPixelSize prefers CSS viewport size over backing store size', () => {
  const viewport = getViewportPixelSize({
    width: 2560,
    height: 1440,
    clientWidth: 1280,
    clientHeight: 720,
  });

  assert.deepEqual(viewport, {
    width: 1280,
    height: 720,
  });
});
