import { useState } from 'react';
import { Download, Loader2, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import type { StatsData } from '../../types/enterprise';
import type { Enterprise } from '../../types/enterprise';

interface Props {
  stats: StatsData;
}

type ExportLevel = '高' | '中等' | 'confirmed';

export default function ReportExport({ stats }: Props) {
  const [exporting, setExporting] = useState<ExportLevel | null>(null);
  const [done, setDone] = useState<ExportLevel | null>(null);

  async function handleExport(level: ExportLevel) {
    setExporting(level);
    setDone(null);
    try {
      const BATCH = 1000;
      const allRows: Enterprise[] = [];
      let from = 0;

      while (true) {
        let query = supabase.from('enterprises').select('*').range(from, from + BATCH - 1);
        if (level === 'confirmed') {
          query = query.eq('has_cooling_tower', true);
        } else {
          query = query.eq('probability_level', level);
        }
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
        '有冷却塔': e.has_cooling_tower ? '是' : '否',
        '冷却塔数量': e.cooling_tower_count,
        '识别置信度': e.detection_confidence ? (e.detection_confidence * 100).toFixed(1) + '%' : '-',
        '总制冷量(RT)': e.total_cooling_capacity_rt || '-',
        '制冷站额定功率(kW)': e.cooling_station_rated_power_kw || '-',
        '经度': e.longitude || '',
        '纬度': e.latitude || '',
      }));

      const levelLabel = level === '高' ? '高概率' : level === '中等' ? '中概率' : '已确认冷却塔';
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, levelLabel);
      XLSX.writeFile(wb, `浦东新区_${levelLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);

      setDone(level);
      setTimeout(() => setDone(null), 3000);
    } finally {
      setExporting(null);
    }
  }

  const EXPORT_OPTIONS: Array<{
    level: ExportLevel;
    label: string;
    desc: string;
    count: number;
    color: string;
    iconColor: string;
    borderColor: string;
  }> = [
    {
      level: '高',
      label: '导出高概率企业清单',
      desc: '包含卫星图已确认或行业属性强匹配的优先目标企业，适用于直接外呼或实地拜访。',
      count: stats.highProbabilityCount,
      color: 'bg-orange-500/10 hover:bg-orange-500/20',
      iconColor: 'text-orange-400',
      borderColor: 'border-orange-500/30',
    },
    {
      level: '中等',
      label: '导出中概率企业清单',
      desc: '行业属性中等偏高但缺乏物理证据，适合进行二次筛选或电话核查。',
      count: stats.mediumProbabilityCount,
      color: 'bg-amber-500/10 hover:bg-amber-500/20',
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/30',
    },
    {
      level: 'confirmed',
      label: '导出已确认冷却塔企业',
      desc: '卫星图像识别算法已确认有冷却塔的企业，为最高质量的线索数据。',
      count: stats.confirmedCoolingTower,
      color: 'bg-cyan-500/10 hover:bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">数据导出</h2>
        <p className="text-xs text-slate-400">按概率等级导出企业清单，用于线下核查或营销跟进</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {EXPORT_OPTIONS.map((opt) => (
          <div
            key={opt.level}
            className={`border ${opt.borderColor} ${opt.color} rounded-xl p-5 transition-colors`}
          >
            <div className="flex items-start justify-between mb-3">
              <FileSpreadsheet className={`w-6 h-6 ${opt.iconColor}`} />
              <span className={`text-2xl font-bold ${opt.iconColor}`}>
                {opt.count.toLocaleString()}
              </span>
            </div>
            <p className="text-sm font-semibold text-white mb-2">{opt.label}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{opt.desc}</p>
            <button
              onClick={() => handleExport(opt.level)}
              disabled={exporting !== null || opt.count === 0}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all border ${opt.borderColor} ${opt.iconColor} hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {exporting === opt.level ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />导出中...</>
              ) : done === opt.level ? (
                <><CheckCircle className="w-3.5 h-3.5" />导出完成</>
              ) : (
                <><Download className="w-3.5 h-3.5" />下载 Excel</>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">导出字段说明</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { field: '户号', desc: '电力系统唯一识别号' },
            { field: '户名', desc: '企业注册名称' },
            { field: '用电地址', desc: '企业实际用电地址' },
            { field: '行业分类', desc: '原始行业标签' },
            { field: '大类 / 细分类型', desc: '标准化行业分类' },
            { field: '概率等级', desc: '高 / 中等 / 低' },
            { field: '有冷却塔', desc: '是否已确认（是/否）' },
            { field: '冷却塔数量', desc: '卫星图识别到的冷却塔个数' },
            { field: '识别置信度', desc: 'AI识别算法的置信度百分比' },
            { field: '总制冷量(RT)', desc: '估算制冷总容量（冷吨）' },
            { field: '制冷站额定功率(kW)', desc: '估算额定用电功率' },
            { field: '经度 / 纬度', desc: 'WGS84坐标系地理坐标' },
          ].map((item) => (
            <div key={item.field} className="flex gap-2">
              <code className="text-[10px] text-cyan-400 font-mono bg-slate-700/40 px-1.5 py-0.5 rounded flex-shrink-0 h-fit">
                {item.field}
              </code>
              <span className="text-[10px] text-slate-400">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-4">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          注：所有导出文件均为 Excel (.xlsx) 格式，可直接在 Excel 或 WPS 中打开。导出数据为实时查询结果，
          建议在正式使用前核验数量与系统看板数据是否一致。如需自定义筛选条件导出，请使用主界面的筛选功能后点击"导出"按钮。
        </p>
      </div>
    </div>
  );
}
