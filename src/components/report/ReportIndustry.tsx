import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';
import type { ReportData } from '../../hooks/useReportData';

interface Props {
  data: ReportData;
  loading: boolean;
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; count: number } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-white mb-1">{payload[0].payload.name}</p>
      <p className="text-xs text-orange-400">{payload[0].value.toLocaleString()} 家高概率企业</p>
    </div>
  );
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; total: number; rate: number; withCoolingTower: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-white mb-1">{d.name}</p>
      <p className="text-xs text-slate-300">企业总数: {d.total.toLocaleString()} 家</p>
      <p className="text-xs text-cyan-400">冷却塔出现率: {d.rate}%</p>
      <p className="text-xs text-emerald-400">有冷却塔: {d.withCoolingTower} 家</p>
    </div>
  );
}

function MajorBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; total: number; highProb: number; mediumProb: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-white mb-1">{d.name}</p>
      <p className="text-xs text-slate-300">企业总数: {d.total.toLocaleString()} 家</p>
      <p className="text-xs text-orange-400">高概率: {d.highProb.toLocaleString()} 家</p>
      <p className="text-xs text-amber-400">中概率: {d.mediumProb.toLocaleString()} 家</p>
    </div>
  );
}

export default function ReportIndustry({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">正在加载行业数据...</p>
        </div>
      </div>
    );
  }

  const topHighProb = data.topHighProbIndustries.slice(0, 10).map((d) => ({
    name: d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name,
    fullName: d.name,
    count: d.count,
  }));

  const scatterData = data.industryStats
    .filter((d) => d.total >= 10 && d.withCoolingTower > 0)
    .slice(0, 20)
    .map((d) => ({
      ...d,
      name: d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name,
      fullName: d.name,
      z: Math.max(d.withCoolingTower * 3, 20),
    }));

  const scatterColors = scatterData.map((d) => {
    if (d.rate >= 20) return '#06b6d4';
    if (d.rate >= 10) return '#3b82f6';
    return '#475569';
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">行业特征洞察</h2>
        <p className="text-xs text-slate-400">不同行业对中央水冷系统的需求差异与分布特征分析</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">高概率企业行业分布 Top 10</h3>
          <p className="text-[11px] text-slate-400 mb-4">高概率判定的企业按细分行业排序</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topHighProb}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {topHighProb.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i < 3 ? '#f97316' : i < 6 ? '#f59e0b' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">行业冷却塔出现率分布</h3>
          <p className="text-[11px] text-slate-400 mb-4">X轴: 企业总数 · Y轴: 冷却塔出现率 · 气泡大小: 有冷却塔家数</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  dataKey="total"
                  name="企业总数"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  label={{ value: '企业总数', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="rate"
                  name="出现率"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  unit="%"
                  label={{ value: '出现率%', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10 }}
                />
                <ZAxis type="number" dataKey="z" range={[30, 300]} />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatterData} fillOpacity={0.75}>
                  {scatterData.map((_, i) => (
                    <Cell key={i} fill={scatterColors[i]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { color: '#06b6d4', label: '出现率 ≥20%' },
              { color: '#3b82f6', label: '10%~20%' },
              { color: '#475569', label: '<10%' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                <span className="text-[10px] text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">企业类型对比：公建建筑 vs 工业企业</h3>
        <p className="text-[11px] text-slate-400 mb-4">两类企业群体在高概率与中概率中的数量对比</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.majorCategoryStats.slice(0, 8)}
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<MajorBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="highProb" name="高概率" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="mediumProb" name="中概率" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span className="text-[11px] text-slate-400">高概率</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-[11px] text-slate-400">中概率</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">冷却塔出现率 Top 10 行业</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                <th className="text-left pb-2 font-medium">排名</th>
                <th className="text-left pb-2 font-medium">行业细分</th>
                <th className="text-right pb-2 font-medium">企业总数</th>
                <th className="text-right pb-2 font-medium">有冷却塔</th>
                <th className="text-right pb-2 font-medium">出现率</th>
                <th className="text-right pb-2 font-medium">高概率</th>
              </tr>
            </thead>
            <tbody>
              {data.industryStats.slice(0, 10).map((row, i) => (
                <tr key={row.name} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                      i === 0 ? 'bg-orange-500/20 text-orange-400' :
                      i === 1 ? 'bg-amber-500/20 text-amber-400' :
                      i === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-700/40 text-slate-500'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2 text-slate-200">{row.name}</td>
                  <td className="py-2 text-right text-slate-300">{row.total.toLocaleString()}</td>
                  <td className="py-2 text-right text-cyan-400">{row.withCoolingTower}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${Math.min(row.rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-cyan-400 font-medium w-10 text-right">{row.rate}%</span>
                    </div>
                  </td>
                  <td className="py-2 text-right text-orange-400">{row.highProb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
