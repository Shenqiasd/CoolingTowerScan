import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { StatsData } from '../types/enterprise';

export function useStats() {
  const [stats, setStats] = useState<StatsData>({
    totalEnterprises: 0,
    confirmedCoolingTower: 0,
    highProbabilityCount: 0,
    mediumProbabilityCount: 0,
    totalCoolingCapacityMW: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);

    const [totalRes, confirmedRes, highRes, mediumRes, capacityRes] = await Promise.all([
      supabase.from('enterprises').select('*', { count: 'exact', head: true }),
      supabase.from('enterprises').select('*', { count: 'exact', head: true }).eq('has_cooling_tower', true),
      supabase.from('enterprises').select('*', { count: 'exact', head: true }).eq('probability_level', '高'),
      supabase.from('enterprises').select('*', { count: 'exact', head: true }).eq('probability_level', '中'),
      supabase.from('enterprises').select('cooling_station_rated_power_mw').eq('has_cooling_tower', true),
    ]);

    const totalMW = (capacityRes.data || []).reduce(
      (sum, e) => sum + (e.cooling_station_rated_power_mw || 0),
      0
    );

    setStats({
      totalEnterprises: totalRes.count || 0,
      confirmedCoolingTower: confirmedRes.count || 0,
      highProbabilityCount: highRes.count || 0,
      mediumProbabilityCount: mediumRes.count || 0,
      totalCoolingCapacityMW: Math.round(totalMW * 100) / 100,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
