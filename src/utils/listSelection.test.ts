import assert from 'node:assert/strict';
import test from 'node:test';

import { getListSelectionUpdate } from './listSelection.ts';

test('list selection keeps the current tab while updating fly-to target', () => {
  const result = getListSelectionUpdate(
    'list',
    null,
    { latitude: 31.22, longitude: 121.54 }
  );

  assert.deepEqual(result, {
    activeTab: 'list',
    flyTo: {
      latitude: 31.22,
      longitude: 121.54,
    },
  });
});

test('list selection keeps the previous fly-to target when enterprise has no coordinates', () => {
  const currentFlyTo = { latitude: 31.18, longitude: 121.61 };
  const result = getListSelectionUpdate(
    'list',
    currentFlyTo,
    { latitude: null, longitude: null }
  );

  assert.deepEqual(result, {
    activeTab: 'list',
    flyTo: currentFlyTo,
  });
});
