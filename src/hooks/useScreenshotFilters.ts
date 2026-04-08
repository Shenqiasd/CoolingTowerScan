import { useMemo } from 'react';
import type { ScanDetection, DetectionFilters } from '../types/pipeline';

export function useScreenshotFilters(
  detections: ScanDetection[],
  filters: DetectionFilters
): ScanDetection[] {
  return useMemo(() => {
    return detections.filter(d => {
      if (filters.detectionStatus) {
        const status = d.error ? 'error'
          : !d.hasCoolingTower && d.count === 0 && !d.error ? 'no_result'
          : d.hasCoolingTower ? 'detected'
          : 'pending';
        if (status !== filters.detectionStatus) return false;
      }
      if (filters.hasTower === 'yes' && !d.hasCoolingTower) return false;
      if (filters.hasTower === 'no' && d.hasCoolingTower) return false;
      if (d.confidence < filters.confidenceMin || d.confidence > filters.confidenceMax) return false;
      if (filters.source && d.source !== filters.source) return false;
      if (filters.addressLabel && d.addressLabel !== filters.addressLabel) return false;
      return true;
    });
  }, [detections, filters]);
}

export const DEFAULT_FILTERS: DetectionFilters = {
  detectionStatus: '',
  hasTower: '',
  confidenceMin: 0,
  confidenceMax: 1,
  source: '',
  addressLabel: '',
};
