import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectedStitchLayout, buildStitchLayout } from './stitchLayout.ts';

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

test('buildProjectedStitchLayout cuts seams from projected tile centers', () => {
  const lngFromWorldX = (x: number) => (x / 512) * 360 - 180;
  const layout = buildProjectedStitchLayout({
    tileWidth: 100,
    tileHeight: 80,
    gridCols: 3,
    gridRows: 1,
    zoom: 0,
    tiles: [200, 280, 360].map((x, col) => ({
      row: 0,
      col,
      lng: lngFromWorldX(x),
      lat: 0,
      viewportWidth: 100,
      viewportHeight: 80,
    })),
  });

  assert.equal(layout.width, 260);
  assert.equal(layout.height, 80);

  assert.deepEqual(layout.tiles.find((tile) => tile.col === 0), {
    row: 0,
    col: 0,
    srcX: 0,
    srcY: 0,
    srcWidth: 90,
    srcHeight: 80,
    destX: 0,
    destY: 0,
  });

  assert.deepEqual(layout.tiles.find((tile) => tile.col === 1), {
    row: 0,
    col: 1,
    srcX: 10,
    srcY: 0,
    srcWidth: 80,
    srcHeight: 80,
    destX: 90,
    destY: 0,
  });

  assert.deepEqual(layout.tiles.find((tile) => tile.col === 2), {
    row: 0,
    col: 2,
    srcX: 10,
    srcY: 0,
    srcWidth: 90,
    srcHeight: 80,
    destX: 170,
    destY: 0,
  });
});
