import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAPBOX_VIEWPORT_TILE_SIZE,
  SATELLITE_SOURCE_TILE_SIZE,
  viewSpanAtZoom,
} from './rasterViewport.ts';

test('viewSpanAtZoom matches Mapbox GL viewport zoom semantics', () => {
  const span = viewSpanAtZoom(18, 1280, 720, 31.9681894291755);

  assert.equal(SATELLITE_SOURCE_TILE_SIZE, 256);
  assert.equal(MAPBOX_VIEWPORT_TILE_SIZE, 512);
  assert.ok(Math.abs(span.spanLng - 0.0040469658717750695) < 1e-12);
  assert.ok(Math.abs(span.spanLat - 0.0019311816569737637) < 1e-12);
});
