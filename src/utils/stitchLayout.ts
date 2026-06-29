import { projectLngLatToWorldPixels } from './mercatorPixels.ts';

export interface StitchLayoutOptions {
  tileWidth: number;
  tileHeight: number;
  gridCols: number;
  gridRows: number;
  overlapRatio: number;
}

export interface TileLayout {
  row: number;
  col: number;
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
  destX: number;
  destY: number;
}

export interface StitchLayout {
  width: number;
  height: number;
  tiles: TileLayout[];
}

export interface ProjectedStitchTile {
  row: number;
  col: number;
  lng: number;
  lat: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ProjectedStitchLayoutOptions {
  tileWidth: number;
  tileHeight: number;
  gridCols: number;
  gridRows: number;
  zoom: number;
  tiles: ProjectedStitchTile[];
  defaultViewportWidth?: number;
  defaultViewportHeight?: number;
}

function clampOverlapRatio(overlapRatio: number): number {
  return Math.max(0, Math.min(overlapRatio, 0.45));
}

function visibleSegments(size: number, count: number, overlapRatio: number) {
  const halfOverlap = Math.round(size * clampOverlapRatio(overlapRatio) / 2);
  const segments: Array<{ start: number; length: number }> = [];
  let cursor = 0;

  for (let index = 0; index < count; index++) {
    const start = index === 0 ? 0 : halfOverlap;
    const end = index === count - 1 ? size : size - halfOverlap;
    const length = Math.max(1, end - start);
    segments.push({ start, length });
    cursor += length;
  }

  return {
    total: cursor,
    segments,
  };
}

export function buildStitchLayout({
  tileWidth,
  tileHeight,
  gridCols,
  gridRows,
  overlapRatio,
}: StitchLayoutOptions): StitchLayout {
  const cols = visibleSegments(tileWidth, gridCols, overlapRatio);
  const rows = visibleSegments(tileHeight, gridRows, overlapRatio);
  const tiles: TileLayout[] = [];

  let destY = 0;
  for (let row = 0; row < gridRows; row++) {
    let destX = 0;
    for (let col = 0; col < gridCols; col++) {
      tiles.push({
        row,
        col,
        srcX: cols.segments[col].start,
        srcY: rows.segments[row].start,
        srcWidth: cols.segments[col].length,
        srcHeight: rows.segments[row].length,
        destX,
        destY,
      });
      destX += cols.segments[col].length;
    }
    destY += rows.segments[row].length;
  }

  return {
    width: cols.total,
    height: rows.total,
    tiles,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function edgeToPixel(value: number, origin: number, scale: number): number {
  return Math.round((value - origin) * scale);
}

export function buildProjectedStitchLayout({
  tileWidth,
  tileHeight,
  gridCols,
  gridRows,
  zoom,
  tiles,
  defaultViewportWidth = tileWidth,
  defaultViewportHeight = tileHeight,
}: ProjectedStitchLayoutOptions): StitchLayout {
  const indexedTiles = new Map<string, {
    row: number;
    col: number;
    centerX: number;
    centerY: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    scaleX: number;
    scaleY: number;
  }>();

  for (const tile of tiles) {
    const viewportWidth = tile.viewportWidth && tile.viewportWidth > 0
      ? tile.viewportWidth
      : defaultViewportWidth;
    const viewportHeight = tile.viewportHeight && tile.viewportHeight > 0
      ? tile.viewportHeight
      : defaultViewportHeight;
    const center = projectLngLatToWorldPixels(tile.lng, tile.lat, zoom);
    indexedTiles.set(`${tile.row}:${tile.col}`, {
      row: tile.row,
      col: tile.col,
      centerX: center.x,
      centerY: center.y,
      left: center.x - viewportWidth / 2,
      right: center.x + viewportWidth / 2,
      top: center.y - viewportHeight / 2,
      bottom: center.y + viewportHeight / 2,
      scaleX: tileWidth / viewportWidth,
      scaleY: tileHeight / viewportHeight,
    });
  }

  const visibleBounds = new Map<string, {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>();

  let globalLeft = Number.POSITIVE_INFINITY;
  let globalRight = Number.NEGATIVE_INFINITY;
  let globalTop = Number.POSITIVE_INFINITY;
  let globalBottom = Number.NEGATIVE_INFINITY;

  for (const tile of indexedTiles.values()) {
    const leftNeighbor = indexedTiles.get(`${tile.row}:${tile.col - 1}`);
    const rightNeighbor = indexedTiles.get(`${tile.row}:${tile.col + 1}`);
    const topNeighbor = indexedTiles.get(`${tile.row - 1}:${tile.col}`);
    const bottomNeighbor = indexedTiles.get(`${tile.row + 1}:${tile.col}`);

    const left = clamp(
      leftNeighbor ? (leftNeighbor.centerX + tile.centerX) / 2 : tile.left,
      tile.left,
      tile.right,
    );
    const right = clamp(
      rightNeighbor ? (rightNeighbor.centerX + tile.centerX) / 2 : tile.right,
      tile.left,
      tile.right,
    );
    const top = clamp(
      topNeighbor ? (topNeighbor.centerY + tile.centerY) / 2 : tile.top,
      tile.top,
      tile.bottom,
    );
    const bottom = clamp(
      bottomNeighbor ? (bottomNeighbor.centerY + tile.centerY) / 2 : tile.bottom,
      tile.top,
      tile.bottom,
    );

    visibleBounds.set(`${tile.row}:${tile.col}`, { left, right, top, bottom });
    globalLeft = Math.min(globalLeft, left);
    globalRight = Math.max(globalRight, right);
    globalTop = Math.min(globalTop, top);
    globalBottom = Math.max(globalBottom, bottom);
  }

  if (!Number.isFinite(globalLeft) || !Number.isFinite(globalTop)) {
    return buildStitchLayout({
      tileWidth,
      tileHeight,
      gridCols,
      gridRows,
      overlapRatio: 0,
    });
  }

  const resultTiles: TileLayout[] = [];
  let canvasWidth = 1;
  let canvasHeight = 1;

  for (const tile of indexedTiles.values()) {
    const bounds = visibleBounds.get(`${tile.row}:${tile.col}`);
    if (!bounds || bounds.right <= bounds.left || bounds.bottom <= bounds.top) {
      continue;
    }

    const destX = edgeToPixel(bounds.left, globalLeft, tile.scaleX);
    const destY = edgeToPixel(bounds.top, globalTop, tile.scaleY);
    const destRight = edgeToPixel(bounds.right, globalLeft, tile.scaleX);
    const destBottom = edgeToPixel(bounds.bottom, globalTop, tile.scaleY);
    const srcX = clamp(edgeToPixel(bounds.left, tile.left, tile.scaleX), 0, tileWidth - 1);
    const srcY = clamp(edgeToPixel(bounds.top, tile.top, tile.scaleY), 0, tileHeight - 1);
    const srcWidth = clamp(destRight - destX, 1, tileWidth - srcX);
    const srcHeight = clamp(destBottom - destY, 1, tileHeight - srcY);

    resultTiles.push({
      row: tile.row,
      col: tile.col,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      destX,
      destY,
    });
    canvasWidth = Math.max(canvasWidth, destX + srcWidth);
    canvasHeight = Math.max(canvasHeight, destY + srcHeight);
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    tiles: resultTiles,
  };
}
