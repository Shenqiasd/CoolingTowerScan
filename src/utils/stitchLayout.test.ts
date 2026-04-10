import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStitchLayout } from './stitchLayout.ts';

test('buildStitchLayout removes duplicated overlap between adjacent tiles', () => {
  const layout = buildStitchLayout({
    tileWidth: 100,
    tileHeight: 80,
    gridCols: 3,
    gridRows: 2,
    overlapRatio: 0.1,
  });

  assert.equal(layout.width, 280);
  assert.equal(layout.height, 152);

  assert.deepEqual(layout.tiles.find((tile) => tile.row === 0 && tile.col === 0), {
    row: 0,
    col: 0,
    srcX: 0,
    srcY: 0,
    srcWidth: 95,
    srcHeight: 76,
    destX: 0,
    destY: 0,
  });

  assert.deepEqual(layout.tiles.find((tile) => tile.row === 0 && tile.col === 1), {
    row: 0,
    col: 1,
    srcX: 5,
    srcY: 0,
    srcWidth: 90,
    srcHeight: 76,
    destX: 95,
    destY: 0,
  });

  assert.deepEqual(layout.tiles.find((tile) => tile.row === 1 && tile.col === 2), {
    row: 1,
    col: 2,
    srcX: 5,
    srcY: 4,
    srcWidth: 95,
    srcHeight: 76,
    destX: 185,
    destY: 76,
  });
});
