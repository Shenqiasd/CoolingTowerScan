import type { BboxDetection } from '../types/pipeline';

/**
 * Draw bounding boxes on an image and return the result as a Blob.
 * Extracted from DetectionImageModal in DetectionPanel.tsx.
 */
export async function generateAnnotatedImage(
  imageUrl: string,
  detections: BboxDetection[]
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Only set crossOrigin for non-data URLs to avoid CORS taint on canvas
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      ctx.drawImage(img, 0, 0);

      for (const d of detections) {
        const x = d.x1;
        const y = d.y1;
        const w = d.x2 - d.x1;
        const h = d.y2 - d.y1;

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2, canvas.width / 300);
        ctx.strokeRect(x, y, w, h);

        const label = `${(d.confidence * 100).toFixed(0)}%`;
        const fontSize = Math.max(12, canvas.width / 40);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textW = ctx.measureText(label).width;
        const pad = 4;

        ctx.fillStyle = 'rgba(239,68,68,0.85)';
        ctx.fillRect(x, y - fontSize - pad * 2, textW + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x + pad, y - pad);
      }

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
