import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DetectionResult } from '../types/enterprise';

export function useDetectionResults() {
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchForEnterprise = useCallback(async (enterpriseId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('detection_results')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .order('detection_id', { ascending: true });

    if (error) {
      console.error('Fetch detections error:', error);
      setResults([]);
    } else {
      setResults(data || []);
    }
    setLoading(false);
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, fetchForEnterprise, clear };
}
