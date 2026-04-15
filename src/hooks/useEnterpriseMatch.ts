import { useCallback, useState } from 'react';
import { matchEnterprise, confirmEnterpriseMatch, type MatchResult } from '../utils/enterpriseMatcher';
import type { ScanDetection } from '../types/pipeline';

export function useEnterpriseMatch() {
  const [loading, setLoading] = useState(false);

  const match = useCallback(async (lng: number, lat: number): Promise<MatchResult[]> => {
    setLoading(true);
    try {
      return await matchEnterprise(lng, lat);
    } finally {
      setLoading(false);
    }
  }, []);

  const confirm = useCallback(async (
    detection: ScanDetection,
    enterpriseId: string,
    onUpdate: (detection: ScanDetection, update: Partial<ScanDetection>) => void
  ): Promise<void> => {
    await confirmEnterpriseMatch(detection.screenshotId!, enterpriseId, {
      hasCoolingTower: detection.hasCoolingTower,
      count: detection.count,
      confidence: detection.confidence,
      annotatedUrl: detection.annotatedUrl,
    });
    onUpdate(detection, {
      enterpriseId,
      matchedEnterpriseId: enterpriseId,
      candidateStatus: 'approved',
    });
  }, []);

  return { match, confirm, loading };
}
