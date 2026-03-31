import { useState, useRef } from 'react';
import { Zap, Upload, Download, MapPin, Loader2, Building2, ScanEye, ThermometerSun, Activity, Radar } from 'lucide-react';
import { importCsvFile } from '../utils/csvImporter';
import { importDetectionCsv } from '../utils/detectionImporter';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import type { Enterprise, EnterpriseFilters } from '../types/enterprise';
import type { StatsData } from '../types/enterprise';

interface HeaderProps {
  enterprises: Enterprise[];
  filters: EnterpriseFilters;
  totalCount: number;
  stats: StatsData;
  statsLoading: boolean;
  onDataImported: () => void;
  onGeocode: () => void;
  geocoding: boolean;
  geocodeProgress: string;
}

const kpis = [
  {
    key: 'total',
    label: '候选企业',
    icon: Building2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    getValue: (s: StatsData) => s.totalEnterprises.toLocaleString(),
    unit: '家',
  },
  {
    key: 'confirmed',
    label: '确认有中央空调',
    icon: ThermometerSun,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    getValue: (s: StatsData) => s.confirmedCoolingTower.toLocaleString(),
    unit: '家',
  },
  {
    key: 'high',
    label: '高概率',
    icon: ScanEye,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    getValue: (s: StatsData) => s.highProbabilityCount.toLocaleString(),
    unit: '家',
  },
  {
    key: 'medium',
    label: '中概率',
    icon: Radar,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    getValue: (s: StatsData) => s.mediumProbabilityCount.toLocaleString(),
    unit: '家',
  },
  {
    key: 'capacity',
    label: '总装机容量',
    icon: Activity,
    color: 'text-slate-300',
    bg: 'bg-slate-500/10',
    getValue: (s: StatsData) => s.totalCoolingCapacityMW.toFixed(2),
    unit: 'MW',
  },
];

export default function Header({
  enterprises,
  filters,
  totalCount,
  stats,
  statsLoading,
  onDataImported,
  onGeocode,
  geocoding,
  geocodeProgress,
}: HeaderProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [detectImporting, setDetectImporting] = useState(false);
  const [detectProgress, setDetectProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const detectFileRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress('解析中...');

    try {
      const result = await importCsvFile(file, (current, total) => {
        setImportProgress(`${current}/${total}`);
      });

      if (result.errors.length > 0) {
        setImportProgress(`${result.imported}条, ${result.errors.length}个错误`);
      } else {
        setImportProgress(`成功${result.imported}条`);
      }

      onDataImported();
      setTimeout(() => setImportProgress(''), 3000);
    } catch {
      setImportProgress('导入失败');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const BATCH = 1000;
      const allRows: Enterprise[] = [];
      let from = 0;

      while (true) {
        let query = supabase.from('enterprises').select('*').range(from, from + BATCH - 1);

        if (filters.probabilityLevel) query = query.eq('probability_level', filters.probabilityLevel);
        if (filters.detectionStatus) query = query.eq('detection_status', filters.detectionStatus);
        if (filters.industryCategory) query = query.ilike('industry_category', `%${filters.industryCategory}%`);
        if (filters.majorCategory) query = query.eq('major_category', filters.majorCategory);
        if (filters.subCategory) query = query.eq('sub_category', filters.subCategory);
        if (filters.searchText) {
          query = query.or(
            `enterprise_name.ilike.%${filters.searchText}%,address.ilike.%${filters.searchText}%,account_number.ilike.%${filters.searchText}%`
          );
        }
        if (filters.hasCoolingTower === 'yes') query = query.eq('has_cooling_tower', true);
        else if (filters.hasCoolingTower === 'no') query = query.eq('has_cooling_tower', false);

        const { data, error } = await query;
        if (error || !data) break;
        allRows.push(...(data as Enterprise[]));
        if (data.length < BATCH) break;
        from += BATCH;
      }

      const exportData = allRows.map((e) => ({
        '户号': e.account_number,
        '户名': e.enterprise_name,
        '用电地址': e.address,
        '行业分类': e.industry_category,
        '大类': e.major_category,
        '细分类型': e.sub_category,
        '概率等级': e.probability_level,
        '经度': e.longitude || '',
        '纬度': e.latitude || '',
        '有冷却塔': e.has_cooling_tower ? '是' : '否',
        '冷却塔数量': e.cooling_tower_count,
        '识别状态': e.detection_status === 'detected' ? '已识别' : e.detection_status === 'no_result' ? '无结果' : '待识别',
        '估算建筑面积(m2)': e.estimated_building_area,
        '总制冷量(RT)': e.total_cooling_capacity_rt,
        '制冷站额定功率(kW)': e.cooling_station_rated_power_kw,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '企业清单');
      XLSX.writeFile(wb, `浦东新区中央空调识别_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  async function handleDetectionImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setDetectImporting(true);
    setDetectProgress('解析中...');

    try {
      const result = await importDetectionCsv(file, (stage, current, total) => {
        if (total > 0) {
          setDetectProgress(`${stage} ${current}/${total}`);
        } else {
          setDetectProgress(stage);
        }
      });

      if (result.errors.length > 0) {
        setDetectProgress(`${result.imported}条, 匹配${result.matched}家`);
      } else {
        setDetectProgress(`导入${result.imported}条, 匹配${result.matched}家`);
      }

      onDataImported();
      setTimeout(() => setDetectProgress(''), 5000);
    } catch {
      setDetectProgress('导入失败');
      setTimeout(() => setDetectProgress(''), 3000);
    } finally {
      setDetectImporting(false);
      if (detectFileRef.current) detectFileRef.current.value = '';
    }
  }

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">
              浦东新区中央空调识别
            </h1>
            <p className="text-[10px] text-slate-500">冷却塔卫星图像智能识别</p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-700/50 flex-shrink-0" />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {kpis.map((kpi) => (
            <div key={kpi.key} className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-md ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 leading-tight">{kpi.label}</p>
                {statsLoading ? (
                  <div className="h-4 w-10 bg-slate-700/50 rounded animate-pulse mt-0.5" />
                ) : (
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-bold text-white leading-tight">{kpi.getValue(stats)}</span>
                    <span className="text-[10px] text-slate-500">{kpi.unit}</span>
                    {kpi.sub && (
                      <span className="text-[10px] text-slate-500 ml-0.5">({kpi.sub(stats)})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="h-8 w-px bg-slate-700/50 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          {(importProgress || geocodeProgress || detectProgress) && (
            <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full max-w-[180px] truncate">
              {detectProgress || importProgress || geocodeProgress}
            </span>
          )}

          <button
            onClick={onGeocode}
            disabled={geocoding}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-emerald-600/20 text-emerald-400
              border border-emerald-500/30 rounded-md hover:bg-emerald-600/30 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
            title="地理编码"
          >
            {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            编码
          </button>

          <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-700/50 text-slate-200
            border border-slate-600/50 rounded-md hover:bg-slate-700 transition-all cursor-pointer"
            title="导入企业CSV"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            导入
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
          </label>

          <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-teal-600/20 text-teal-400
            border border-teal-500/30 rounded-md hover:bg-teal-600/30 transition-all cursor-pointer"
            title="导入识别结果CSV"
          >
            {detectImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
            识别
            <input
              ref={detectFileRef}
              type="file"
              accept=".csv"
              onChange={handleDetectionImport}
              className="hidden"
              disabled={detectImporting}
            />
          </label>

          <button
            onClick={handleExport}
            disabled={totalCount === 0 || exporting}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-700/50 text-slate-200
              border border-slate-600/50 rounded-md hover:bg-slate-700 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
            title={`导出全量数据 (${totalCount.toLocaleString()}条)`}
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            导出
          </button>
        </div>
      </div>
    </header>
  );
}
