export function buildStitchedStoragePath(sessionId: string | null, zoomLevel: number): string {
  return `${sessionId ?? 'nosession'}/stitched/stitched_Z${zoomLevel}.png`;
}
