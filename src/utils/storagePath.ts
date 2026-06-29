export function buildStitchedStoragePath(
  sessionId: string | null,
  zoomLevel: number,
  extension = 'jpg',
): string {
  return `${sessionId ?? 'nosession'}/stitched/stitched_Z${zoomLevel}.${extension}`;
}
