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
