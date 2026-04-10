import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateAnnotatedImage } from '../utils/annotatedImageGenerator';
import { SCREENSHOT_STORAGE_BUCKET } from '../utils/storageBuckets';
import type { ScanDetection } from '../types/pipeline';

export interface AnnotatedUploadResult {
  done: number;
  failed: number;
  skipped: number;
}

export function useAnnotatedUpload() {
  const uploadAnnotated = useCallback(async (
    detection: ScanDetection,
    onUpdate: (detection: ScanDetection, update: Partial<ScanDetection>) => void
  ): Promise<'done' | 'failed' | 'skipped'> => {
    if (!detection.hasCoolingTower) {
      return 'skipped';
    }

    if (!detection.detections.length) {
      onUpdate(detection, { uploadStatus: 'failed' });
      return 'failed';
    }

    // Prefer dataUrl (base64, no CORS) over publicUrl for canvas annotation
    const imageUrl = detection.dataUrl || detection.imageUrl || detection.publicUrl;
    if (!imageUrl) {
      onUpdate(detection, { uploadStatus: 'failed' });
      return 'failed';
    }

    onUpdate(detection, { uploadStatus: 'uploading' });

    try {
      const blob = await generateAnnotatedImage(imageUrl, detection.detections);
      if (!blob) throw new Error('canvas generation failed');

      const objectName = detection.screenshotId ?? detection.screenshotFilename;
      const path = `annotated/${objectName}.png`;
      const { error } = await supabase.storage
        .from(SCREENSHOT_STORAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from(SCREENSHOT_STORAGE_BUCKET).getPublicUrl(path);
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

      onUpdate(detection, { annotatedUrl, uploadStatus: 'done' });
      return 'done';
    } catch (error) {
      console.error('Annotated upload failed:', error);
      onUpdate(detection, { uploadStatus: 'failed' });
      return 'failed';
    }
  }, []);

  const uploadAllAnnotated = useCallback(async (
    detections: ScanDetection[],
    onUpdate: (detection: ScanDetection, update: Partial<ScanDetection>) => void
  ): Promise<AnnotatedUploadResult> => {
    const withTowers = detections.filter(d => d.hasCoolingTower && !d.annotatedUrl);
    const result: AnnotatedUploadResult = { done: 0, failed: 0, skipped: 0 };

    for (const d of withTowers) {
      const outcome = await uploadAnnotated(d, onUpdate);
      result[outcome] += 1;
    }

    return result;
  }, [uploadAnnotated]);

  return { uploadAnnotated, uploadAllAnnotated };
}
