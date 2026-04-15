import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRunRestore } from './activeScanTaskRestorePolicy.ts';

test('shouldRunRestore allows automatic restore only before initial hydration', () => {
  assert.equal(shouldRunRestore({ hasAutoRestored: false, explicitSessionId: null }), true);
  assert.equal(shouldRunRestore({ hasAutoRestored: true, explicitSessionId: null }), false);
});

test('shouldRunRestore always allows explicit task restore', () => {
  assert.equal(shouldRunRestore({ hasAutoRestored: false, explicitSessionId: 'session-1' }), true);
  assert.equal(shouldRunRestore({ hasAutoRestored: true, explicitSessionId: 'session-1' }), true);
});
