import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { StatsData } from '../types/enterprise';

export function useStats() {
  const [stats, setStats] = useState<StatsData>({
    totalEnterprises: 0,
    detectedCount: 0,
    confirmedCoolingTower: 0,
    totalCoolingCapacityMW: 0,
    detectionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);

    const [totalRes, detectedRes, confirmedRes, capacityRes] = await Promise.all([
      supabase.from('enterprises').select('*', { count: 'exact', head: true }),
      supabase.from('enterprises').select('*', { count: 'exact', head: true }).eq('detection_status', 'detected'),
      supabase.from('enterprises').select('*', { count: 'exact', head: true }).eq('has_cooling_tower', true),
      supabase.from('enterprises').select('cooling_station_rated_power_mw').eq('has_cooling_tower', true),
    ]);

    const total = totalRes.count || 0;
    const detected = detectedRes.count || 0;
    const confirmed = confirmedRes.count || 0;
    const totalMW = (capacityRes.data || []).reduce(
      (sum, e) => sum + (e.cooling_station_rated_power_mw || 0),
      0
    );

    setStats({
      totalEnterprises: total,
      detectedCount: detected,
      confirmedCoolingTower: confirmed,
      totalCoolingCapacityMW: Math.round(totalMW * 100) / 100,
      detectionRate: total > 0 ? Math.round((detected / total) * 100) : 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
