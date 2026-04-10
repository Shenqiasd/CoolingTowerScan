import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeAmapResults,
  normalizeOsmResults,
  type SearchProviderResult,
} from './locationSearch.ts';

test('normalizeAmapResults surfaces invalid key instead of pretending there are no results', () => {
  const payload = {
    status: '0',
    info: 'INVALID_USER_KEY',
    infocode: '10001',
  };

  const result = normalizeAmapResults(payload);

  assert.equal(result.provider, 'amap');
  assert.equal(result.results.length, 0);
  assert.equal(result.error, 'INVALID_USER_KEY (10001)');
});

test('normalizeOsmResults keeps china search results as WGS84 coordinates', () => {
  const payload = [
    {
      display_name: '日月光半导体(上海)有限公司, 杨家镇, 三桥, 中国',
      name: '日月光半导体(上海)有限公司',
      lon: '121.5928574',
      lat: '31.2179308',
    },
  ];

  const result: SearchProviderResult = normalizeOsmResults(payload);

  assert.equal(result.provider, 'osm');
  assert.equal(result.error, null);
  assert.deepEqual(result.results, [
    {
      name: '日月光半导体(上海)有限公司',
      address: '日月光半导体(上海)有限公司, 杨家镇, 三桥, 中国',
      location: '121.5928574,31.2179308',
      coordinateSystem: 'wgs84',
    },
  ]);
});
