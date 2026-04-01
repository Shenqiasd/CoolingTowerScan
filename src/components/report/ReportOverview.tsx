import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { StatsData } from '../../types/enterprise';

interface Props {
  stats: StatsData;
}

const PROB_DATA = (stats: StatsData) => [
  { name: '高概率', value: stats.highProbabilityCount, color: '#f97316', pct: stats.totalEnterprises > 0 ? ((stats.highProbabilityCount / stats.totalEnterprises) * 100).toFixed(1) : '0' },
  { name: '中概率', value: stats.mediumProbabilityCount, color: '#f59e0b', pct: stats.totalEnterprises > 0 ? ((stats.mediumProbabilityCount / stats.totalEnterprises) * 100).toFixed(1) : '0' },
  { name: '低概率', value: stats.lowProbabilityCount, color: '#64748b', pct: stats.totalEnterprises > 0 ? ((stats.lowProbabilityCount / stats.totalEnterprises) * 100).toFixed(1) : '0' },
];

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
  value: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { pct: string; color: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-white">{d.name}</p>
      <p className="text-xs text-slate-300">{d.value.toLocaleString()} 家</p>
      <p className="text-xs text-slate-400">占比 {d.payload.pct}%</p>
    </div>
  );
}

function CenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        总计
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#ffffff" fontSize={20} fontWeight="bold">
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        家
      </text>
    </g>
  );
}

const KPI_CARDS = [
  {
    label: '总企业数',
    getValue: (s: StatsData) => s.totalEnterprises,
    pct: '100%',
    desc: '分析的基础样本盘',
    color: 'border-blue-500/40 bg-blue-500/5',
    textColor: 'text-blue-400',
  },
  {
    label: '高概率企业',
    getValue: (s: StatsData) => s.highProbabilityCount,
    getPct: (s: StatsData) => s.totalEnterprises > 0 ? ((s.highProbabilityCount / s.totalEnterprises) * 100).toFixed(1) + '%' : '-',
    desc: '重点营销与核查的优先目标',
    color: 'border-orange-500/40 bg-orange-500/5',
    textColor: 'text-orange-400',
  },
  {
    label: '中概率企业',
    getValue: (s: StatsData) => s.mediumProbabilityCount,
    getPct: (s: StatsData) => s.totalEnterprises > 0 ? ((s.mediumProbabilityCount / s.totalEnterprises) * 100).toFixed(1) + '%' : '-',
    desc: '具备潜力，需进一步筛选的次优目标',
    color: 'border-amber-500/40 bg-amber-500/5',
    textColor: 'text-amber-400',
  },
  {
    label: '低概率企业',
    getValue: (s: StatsData) => s.lowProbabilityCount,
    getPct: (s: StatsData) => s.totalEnterprises > 0 ? ((s.lowProbabilityCount / s.totalEnterprises) * 100).toFixed(1) + '%' : '-',
    desc: '暂不作为重点跟进对象',
    color: 'border-slate-600/40 bg-slate-700/20',
    textColor: 'text-slate-400',
  },
  {
    label: '已确认冷却塔',
    getValue: (s: StatsData) => s.confirmedCoolingTower,
    getPct: (s: StatsData) => s.totalEnterprises > 0 ? ((s.confirmedCoolingTower / s.totalEnterprises) * 100).toFixed(1) + '%' : '-',
    desc: '卫星图扫描到的确凿物理证据',
    color: 'border-cyan-500/40 bg-cyan-500/5',
    textColor: 'text-cyan-400',
  },
];

export default function ReportOverview({ stats }: Props) {
  const probData = PROB_DATA(stats);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">数据总览看板</h2>
        <p className="text-xs text-slate-400">基于卫星图像识别与行业属性分析的企业中央水冷系统概率分布</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
            <p className="text-[11px] text-slate-400 mb-2">{card.label}</p>
            <p className={`text-2xl font-bold ${card.textColor} mb-0.5`}>
              {card.getValue(stats).toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-slate-500">家</span>
              {card.getPct && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-700/50 ${card.textColor}`}>
                  {card.getPct(stats)}
                </span>
              )}
              {card.pct && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
                  {card.pct}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">概率等级分布</h3>
          <p className="text-[11px] text-slate-400 mb-4">高/中/低概率企业占比结构</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={probData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                >
                  {probData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                  <CenterLabel cx={0} cy={0} total={stats.totalEnterprises} />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value, entry) => {
                    const d = entry.payload as typeof probData[0];
                    return (
                      <span className="text-[11px] text-slate-300">
                        {value} {d.value.toLocaleString()}家 ({d.pct}%)
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">关键指标说明</h3>
          <p className="text-[11px] text-slate-400 mb-4">各概率等级的业务含义与推进策略</p>
          <div className="space-y-3">
            {[
              {
                level: '高概率',
                color: 'bg-orange-500',
                badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                desc: '卫星图已发现冷却塔，或行业需求强烈且有多项佐证，应作为优先级最高的拜访与核查对象。',
                action: '立即跟进',
              },
              {
                level: '中概率',
                color: 'bg-amber-500',
                badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                desc: '行业需求中等偏高，卫星图暂无直接证据，建议通过电话或实地调查进一步确认。',
                action: '二次筛选',
              },
              {
                level: '低概率',
                color: 'bg-slate-500',
                badge: 'bg-slate-600/30 text-slate-400 border-slate-600/40',
                desc: '行业需求较低，无卫星图证据，可暂时不作为主要跟进对象，节省营销资源。',
                action: '暂缓跟进',
              },
              {
                level: '已确认',
                color: 'bg-cyan-500',
                badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
                desc: '卫星图像识别算法已在企业屋顶/场地发现冷却塔实体，属于最确凿的物理证据。',
                action: '重点核查',
              },
            ].map((item) => (
              <div key={item.level} className="flex gap-3 items-start">
                <div className={`w-1.5 h-1.5 rounded-full ${item.color} mt-1.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-white">{item.level}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${item.badge}`}>
                      {item.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
