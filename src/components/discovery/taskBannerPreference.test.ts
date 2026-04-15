import assert from 'node:assert/strict';
import test from 'node:test';

import { getInitialTaskBannerCollapsed, parseTaskBannerPreference } from './taskBannerPreference.ts';

test('parseTaskBannerPreference accepts valid persisted values only', () => {
  assert.equal(parseTaskBannerPreference('collapsed'), 'collapsed');
  assert.equal(parseTaskBannerPreference('expanded'), 'expanded');
  assert.equal(parseTaskBannerPreference('other'), null);
  assert.equal(parseTaskBannerPreference(null), null);
});

test('getInitialTaskBannerCollapsed defaults to collapsed on screenshot step', () => {
  assert.equal(getInitialTaskBannerCollapsed('screenshot', null), true);
});

test('getInitialTaskBannerCollapsed defaults to expanded outside screenshot step', () => {
  assert.equal(getInitialTaskBannerCollapsed('detection', null), false);
  assert.equal(getInitialTaskBannerCollapsed('results', null), false);
});

test('getInitialTaskBannerCollapsed respects persisted user preference', () => {
  assert.equal(getInitialTaskBannerCollapsed('screenshot', 'expanded'), false);
  assert.equal(getInitialTaskBannerCollapsed('results', 'collapsed'), true);
});
