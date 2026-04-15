import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAreaBoundsFromCenter } from './areaModeModel.ts';

test('buildAreaBoundsFromCenter creates symmetric area around selected center', () => {
  const bounds = buildAreaBoundsFromCenter(0, 0, {
    widthMeters: 222640,
    heightMeters: 111320,
  });

  assert.deepEqual(bounds, {
    topLeftLng: -1,
    topLeftLat: 0.5,
    bottomRightLng: 1,
    bottomRightLat: -0.5,
  });
});

test('buildAreaBoundsFromCenter keeps center inside generated bounds at typical China latitude', () => {
  const centerLng = 121.4737;
  const centerLat = 31.2304;
  const bounds = buildAreaBoundsFromCenter(centerLng, centerLat);

  assert.ok(bounds.topLeftLng < centerLng);
  assert.ok(bounds.bottomRightLng > centerLng);
  assert.ok(bounds.topLeftLat > centerLat);
  assert.ok(bounds.bottomRightLat < centerLat);
});
