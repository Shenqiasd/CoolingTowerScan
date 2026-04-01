import { CheckCircle, AlertCircle, Info } from 'lucide-react';

const HIGH_DEMAND_INDUSTRIES = [
  { name: '数据中心/IT', rate: '23.0%', desc: '服务器散热需求极高，全年制冷不中断' },
  { name: '医药生物', rate: '30.3%', desc: '洁净室与实验室要求恒温恒湿' },
  { name: '医院', rate: '21.6%', desc: '手术室、ICU等特殊区域制冷需求强' },
  { name: '汽车制造', rate: '18.4%', desc: '喷涂车间与测试区域需精确温控' },
  { name: '电子电器制造', rate: '15.7%', desc: '防静电与精密组装要求高' },
  { name: '半导体/芯片', rate: '28.1%', desc: '晶圆制造对温湿度控制要求极严格' },
  { name: '金融/银行', rate: '12.3%', desc: '数据机房与交易厅散热需求' },
  { name: '商业综合体', rate: '11.8%', desc: '大型商场营业面积大，人流密度高' },
  { name: '酒店/宾馆', rate: '9.6%', desc: '客房与公共区域中央空调普遍配置' },
  { name: '食品饮料加工', rate: '14.2%', desc: '生产线温控与冷藏仓储需求' },
];

const MEDIUM_DEMAND_INDUSTRIES = [
  { name: '办公楼宇', rate: '6.8%', desc: '大型写字楼多配置中央空调系统' },
  { name: '政府机关/事业单位', rate: '5.4%', desc: '大型办公建筑具备一定需求' },
  { name: '教育/学校', rate: '4.2%', desc: '图书馆、实验楼等特殊功能区' },
  { name: '化工/石化', rate: '8.9%', desc: '工艺冷却与反应控温需求' },
  { name: '印刷/包装', rate: '5.1%', desc: '印刷车间温湿度控制要求' },
];

const LOGIC_NODES = [
  {
    id: 'start',
    label: '开始：企业评分',
    desc: '以行业属性 + 卫星识别结果为输入',
    color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
  },
  {
    id: 'satellite',
    label: '卫星图识别状态',
    desc: '是否通过AI算法在卫星图中检测到冷却塔',
    color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
    branches: [
      { label: '已检测到冷却塔', next: '高概率', color: 'text-emerald-400' },
      { label: '未检测 / 待识别', next: '行业维度', color: 'text-slate-400' },
    ],
  },
  {
    id: 'industry',
    label: '行业需求等级',
    desc: '根据行业分类判断中央水冷系统需求强度',
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
    branches: [
      { label: '高需求行业（10类）', next: '高概率', color: 'text-orange-400' },
      { label: '中高需求行业（5类）', next: '中概率', color: 'text-amber-400' },
      { label: '其他行业', next: '低概率', color: 'text-slate-400' },
    ],
  },
];

export default function ReportLogic() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">识别逻辑与模型说明</h2>
        <p className="text-xs text-slate-400">中央水冷系统概率判断的决策路径与规则体系（v2 版本）</p>
      </div>

      <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-400 mb-1">v2 版本重要变更说明</p>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            当前版本（v2）已移除"估算建筑面积"作为评分维度。原因：该字段基于地址反推，误差率超过 40%，数据可靠性不足以支撑商业决策。
            v2 版本专注于两个高可信度维度：<strong className="text-white">卫星图像物理证据</strong> + <strong className="text-white">行业属性统计规律</strong>，确保分析结果的准确性与可解释性。
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">决策路径流程图</h3>
        <div className="flex flex-col items-center gap-0">
          <div className="border border-cyan-500/50 bg-cyan-500/10 rounded-xl px-6 py-3 text-center">
            <p className="text-xs font-semibold text-cyan-400">企业基础数据输入</p>
            <p className="text-[10px] text-slate-400 mt-0.5">行业分类 · 户名 · 用电地址 · 卫星图像</p>
          </div>

          <div className="w-px h-6 bg-slate-600" />

          <div className="border border-blue-500/50 bg-blue-500/10 rounded-xl px-6 py-3 text-center w-72">
            <p className="text-xs font-semibold text-blue-400">第一维度：卫星图像识别</p>
            <p className="text-[10px] text-slate-400 mt-0.5">AI算法检测屋顶/场地是否有冷却塔实体</p>
          </div>

          <div className="flex items-start gap-16 mt-0">
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-slate-600" />
              <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full mb-2">
                检测到冷却塔
              </div>
              <div className="border-2 border-orange-500/60 bg-orange-500/10 rounded-xl px-5 py-2.5 text-center">
                <p className="text-sm font-bold text-orange-400">高概率</p>
                <p className="text-[10px] text-slate-400">物理证据确凿</p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-slate-600" />
              <div className="text-[10px] text-slate-400 bg-slate-700/50 border border-slate-600/30 px-2 py-0.5 rounded-full mb-2">
                未检测 / 待识别
              </div>
              <div className="border border-amber-500/50 bg-amber-500/10 rounded-xl px-6 py-3 text-center w-64">
                <p className="text-xs font-semibold text-amber-400">第二维度：行业需求等级</p>
                <p className="text-[10px] text-slate-400 mt-0.5">根据统计规律判断需求强度</p>
              </div>
              <div className="flex items-start gap-8 mt-0">
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-slate-600" />
                  <div className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full mb-1.5">
                    高需求
                  </div>
                  <div className="border border-orange-500/40 bg-orange-500/8 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-xs font-bold text-orange-400">高概率</p>
                    <p className="text-[10px] text-slate-400">10类行业</p>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-slate-600" />
                  <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full mb-1.5">
                    中高需求
                  </div>
                  <div className="border border-amber-500/40 bg-amber-500/8 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-xs font-bold text-amber-400">中概率</p>
                    <p className="text-[10px] text-slate-400">5类行业</p>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-slate-600" />
                  <div className="text-[10px] text-slate-400 bg-slate-700/40 border border-slate-600/30 px-1.5 py-0.5 rounded-full mb-1.5">
                    低需求
                  </div>
                  <div className="border border-slate-600/40 bg-slate-700/20 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-xs font-bold text-slate-400">低概率</p>
                    <p className="text-[10px] text-slate-400">其他</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-slate-800/50 border border-orange-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">高需求行业（10类）</h3>
          </div>
          <div className="space-y-2">
            {HIGH_DEMAND_INDUSTRIES.map((item) => (
              <div key={item.name} className="flex items-start gap-2 py-1.5 border-b border-slate-700/30 last:border-0">
                <div className="flex items-center gap-2 w-36 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-xs text-white font-medium truncate">{item.name}</span>
                </div>
                <span className="text-xs text-orange-400 font-mono w-12 flex-shrink-0">{item.rate}</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">中高需求行业（5类）</h3>
          </div>
          <div className="space-y-2 mb-4">
            {MEDIUM_DEMAND_INDUSTRIES.map((item) => (
              <div key={item.name} className="flex items-start gap-2 py-1.5 border-b border-slate-700/30 last:border-0">
                <div className="flex items-center gap-2 w-36 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-xs text-white font-medium truncate">{item.name}</span>
                </div>
                <span className="text-xs text-amber-400 font-mono w-12 flex-shrink-0">{item.rate}</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-3 mt-2">
            <p className="text-[10px] font-semibold text-slate-300 mb-1">冷却塔出现率基准说明</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              冷却塔出现率 = 该行业"已确认有冷却塔企业数" / "该行业企业总数"。
              数据基于当前卫星图像识别结果统计，随识别覆盖率提升会持续更新。
              行业归属以电力数据系统的行业分类码为准。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
