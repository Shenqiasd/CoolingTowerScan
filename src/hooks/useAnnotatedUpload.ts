import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateAnnotatedImage } from '../utils/annotatedImageGenerator';
import type { ScanDetection } from '../types/pipeline';

export function useAnnotatedUpload() {
  const uploadAnnotated = useCallback(async (
    detection: ScanDetection,
    onUpdate: (filename: string, update: Partial<ScanDetection>) => void
  ): Promise<void> => {
    if (!detection.hasCoolingTower || !detection.detections.length) return;
    const imageUrl = detection.imageUrl || detection.publicUrl;
    if (!imageUrl) return;

    onUpdate(detection.screenshotFilename, { uploadStatus: 'uploading' });

    try {
      const blob = await generateAnnotatedImage(imageUrl, detection.detections);
      if (!blob) throw new Error('canvas generation failed');

      const path = `annotated/${detection.screenshotFilename}`;
      const { error } = await supabase.storage
        .from('scan-screenshots')
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from('scan-screenshots').getPublicUrl(path);
      const annotatedUrl = data.publicUrl;

      // Update scan_screenshots table
      if (detection.screenshotId) {
        await supabase
          .from('scan_screenshots')
          .update({ annotated_url: annotatedUrl })
          .eq('id', detection.screenshotId);
      }

      // Update enterprises.annotated_image_url if linked
      if (detection.enterpriseId) {
        await supabase
          .from('enterprises')
          .update({ annotated_image_url: annotatedUrl })
          .eq('id', detection.enterpriseId);
      }

      onUpdate(detection.screenshotFilename, { annotatedUrl, uploadStatus: 'done' });
    } catch {
      onUpdate(detection.screenshotFilename, { uploadStatus: 'failed' });
    }
  }, []);

  const uploadAllAnnotated = useCallback(async (
    detections: ScanDetection[],
    onUpdate: (filename: string, update: Partial<ScanDetection>) => void
  ): Promise<void> => {
    const withTowers = detections.filter(d => d.hasCoolingTower && !d.annotatedUrl);
    for (const d of withTowers) {
      await uploadAnnotated(d, onUpdate);
    }
  }, [uploadAnnotated]);

  return { uploadAnnotated, uploadAllAnnotated };
}
