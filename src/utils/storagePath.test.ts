import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStitchedStoragePath } from './storagePath.ts';

test('buildStitchedStoragePath keeps Supabase object keys ASCII-safe', () => {
  const path = buildStitchedStoragePath('session-123', 18);

  assert.equal(path, 'session-123/stitched/stitched_Z18.png');
  assert.equal([...path].every((char) => char.charCodeAt(0) <= 0x7f), true);
});
