import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface MapMarker {
  id: string;
  enterprise_name: string;
  address: string;
  latitude: number;
  longitude: number;
  probability_level: string;
  has_cooling_tower: boolean;
  cooling_tower_count: number;
  detection_status: string;
  detection_confidence: number;
  cooling_station_rated_power_mw: number;
  composite_score: number;
}

export function useMapMarkers() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
    const allMarkers: MapMarker[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('enterprises')
        .select('id, enterprise_name, address, latitude, longitude, probability_level, has_cooling_tower, cooling_tower_count, detection_status, detection_confidence, cooling_station_rated_power_mw, composite_score')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Fetch markers error:', error);
        break;
      }

      if (data && data.length > 0) {
        allMarkers.push(...(data as MapMarker[]));
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    setMarkers(allMarkers);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMarkers();
  }, [fetchMarkers]);

  return { markers, loading, refresh: fetchMarkers };
}
