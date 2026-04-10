import assert from 'node:assert/strict';
import test from 'node:test';

import { SATELLITE_TILE_SIZE, viewSpanAtZoom } from './rasterViewport.ts';

test('viewSpanAtZoom matches the configured raster tile size used by screenshot maps', () => {
  const span = viewSpanAtZoom(18, 1280, 720, 31.9681894291755);

  assert.equal(SATELLITE_TILE_SIZE, 256);
  assert.ok(Math.abs(span.spanLng - 0.008093931743550139) < 1e-12);
  assert.ok(Math.abs(span.spanLat - 0.0038623633139475274) < 1e-12);
});
