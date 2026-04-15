import { Building2, ScanEye, ThermometerSun, Activity, Radar, MinusCircle } from 'lucide-react';
import type { StatsData } from '../types/enterprise';

interface HeaderProps {
  stats: StatsData;
  statsLoading: boolean;
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
    key: 'low',
    label: '低概率',
    icon: MinusCircle,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    getValue: (s: StatsData) => s.lowProbabilityCount.toLocaleString(),
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
  {
    key: 'scan-tasks',
    label: '扫描任务',
    icon: Radar,
    color: 'text-violet-300',
    bg: 'bg-violet-500/10',
    getValue: (s: StatsData) => s.totalScanTasks.toLocaleString(),
    unit: '个',
  },
  {
    key: 'pending-review',
    label: '待审核候选',
    icon: ScanEye,
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    getValue: (s: StatsData) => s.pendingReviewCandidates.toLocaleString(),
    unit: '个',
  },
  {
    key: 'needs-binding',
    label: '待绑定企业',
    icon: Building2,
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    getValue: (s: StatsData) => s.needsBindingCandidates.toLocaleString(),
    unit: '个',
  },
];

export default function Header({ stats, statsLoading }: HeaderProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.key}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${kpi.bg} border border-slate-700/30`}
          >
            <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-400">{kpi.label}</span>
              <span className={`text-sm font-semibold ${kpi.color}`}>
                {statsLoading ? '-' : kpi.getValue(stats)}
              </span>
              <span className="text-[10px] text-slate-500">{kpi.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
