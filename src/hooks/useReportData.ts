import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface IndustryStats {
  name: string;
  total: number;
  withCoolingTower: number;
  rate: number;
  highProb: number;
}

export interface ReportData {
  industryStats: IndustryStats[];
  majorCategoryStats: { name: string; total: number; highProb: number; mediumProb: number }[];
  topHighProbIndustries: { name: string; count: number }[];
}

export function useReportData() {
  const [data, setData] = useState<ReportData>({
    industryStats: [],
    majorCategoryStats: [],
    topHighProbIndustries: [],
  });
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const BATCH = 1000;
      const allRows: Array<{
        major_category: string;
        sub_category: string;
        probability_level: string;
        has_cooling_tower: boolean;
      }> = [];

      let from = 0;
      while (true) {
        const { data: rows } = await supabase
          .from('enterprises')
          .select('major_category, sub_category, probability_level, has_cooling_tower')
          .range(from, from + BATCH - 1);
        if (!rows || rows.length === 0) break;
        allRows.push(...rows);
        if (rows.length < BATCH) break;
        from += BATCH;
      }

      const subMap = new Map<string, { total: number; withCooling: number; highProb: number }>();
      const majorMap = new Map<string, { total: number; highProb: number; mediumProb: number }>();

      for (const row of allRows) {
        const sub = row.sub_category || row.major_category || '其他';
        const major = row.major_category || '其他';

        if (!subMap.has(sub)) subMap.set(sub, { total: 0, withCooling: 0, highProb: 0 });
        const s = subMap.get(sub)!;
        s.total++;
        if (row.has_cooling_tower) s.withCooling++;
        if (row.probability_level === '高') s.highProb++;

        if (!majorMap.has(major)) majorMap.set(major, { total: 0, highProb: 0, mediumProb: 0 });
        const m = majorMap.get(major)!;
        m.total++;
        if (row.probability_level === '高') m.highProb++;
        if (row.probability_level === '中等') m.mediumProb++;
      }

      const industryStats: IndustryStats[] = Array.from(subMap.entries())
        .map(([name, v]) => ({
          name,
          total: v.total,
          withCoolingTower: v.withCooling,
          rate: v.total > 0 ? Math.round((v.withCooling / v.total) * 1000) / 10 : 0,
          highProb: v.highProb,
        }))
        .filter((x) => x.total >= 5)
        .sort((a, b) => b.rate - a.rate);

      const majorCategoryStats = Array.from(majorMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total);

      const topHighProbIndustries = Array.from(subMap.entries())
        .map(([name, v]) => ({ name, count: v.highProb }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      setData({ industryStats, majorCategoryStats, topHighProbIndustries });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refresh: fetchData };
}
