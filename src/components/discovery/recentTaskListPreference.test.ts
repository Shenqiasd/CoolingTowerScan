import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInitialRecentTaskListCollapsed,
  parseRecentTaskListPreference,
} from './recentTaskListPreference.ts';

test('parseRecentTaskListPreference accepts valid persisted values only', () => {
  assert.equal(parseRecentTaskListPreference('collapsed'), 'collapsed');
  assert.equal(parseRecentTaskListPreference('expanded'), 'expanded');
  assert.equal(parseRecentTaskListPreference('other'), null);
  assert.equal(parseRecentTaskListPreference(null), null);
});

test('getInitialRecentTaskListCollapsed defaults to collapsed on screenshot step', () => {
  assert.equal(getInitialRecentTaskListCollapsed('screenshot', null), true);
});

test('getInitialRecentTaskListCollapsed defaults to expanded outside screenshot step', () => {
  assert.equal(getInitialRecentTaskListCollapsed('detection', null), false);
  assert.equal(getInitialRecentTaskListCollapsed('results', null), false);
});

test('getInitialRecentTaskListCollapsed respects persisted user preference', () => {
  assert.equal(getInitialRecentTaskListCollapsed('screenshot', 'expanded'), false);
  assert.equal(getInitialRecentTaskListCollapsed('results', 'collapsed'), true);
});
