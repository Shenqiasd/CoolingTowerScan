import { Search, X } from 'lucide-react';
import type { EnterpriseFilters } from '../types/enterprise';

interface FilterBarProps {
  filters: EnterpriseFilters;
  onChange: (filters: EnterpriseFilters) => void;
  totalCount: number;
}

const INDUSTRIAL_SUB_CATEGORIES = [
  '其他制造业', '建筑施工', '物流仓储', '机械装备', '电子电器',
  '电力能源', '汽车制造', '化工', '医药生物', '包装印刷',
  '农林牧渔', '冶金金属', '食品饮料', '纺织服装', '建材', '采矿',
];

const PUBLIC_SUB_CATEGORIES = [
  '医院', '高等院校', '中学', '小学/幼儿园', '其他教育', '培训机构',
  '酒店', '商业综合体', '办公楼宇', '零售商场', '批发市场',
  '金融', '科研机构', '数据中心/IT', '政府机关', '文化场馆',
  '体育场馆', '文娱', '住宿餐饮', '餐饮', '社会福利', '卫生机构',
  '公共设施', '交通运输', '商务服务', '社区服务', '住宅小区',
  '房地产', '国际机构',
];

export default function FilterBar({ filters, onChange, totalCount }: FilterBarProps) {
  function update(key: keyof EnterpriseFilters, value: string) {
    if (key === 'majorCategory') {
      onChange({ ...filters, majorCategory: value, subCategory: '' });
    } else {
      onChange({ ...filters, [key]: value });
    }
  }

  function clearAll() {
    onChange({
      probabilityLevel: '',
      detectionStatus: '',
      industryCategory: '',
      majorCategory: '',
      subCategory: '',
      searchText: '',
      hasCoolingTower: '',
    });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const subCategoryOptions =
    filters.majorCategory === '工业企业'
      ? INDUSTRIAL_SUB_CATEGORIES
      : filters.majorCategory === '公建建筑'
      ? PUBLIC_SUB_CATEGORIES
      : [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 max-w-[220px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="搜索企业名称、地址..."
          value={filters.searchText}
          onChange={(e) => update('searchText', e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-slate-800/50 border border-slate-700/40 rounded-md
            text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
        />
      </div>

      <select
        value={filters.majorCategory}
        onChange={(e) => update('majorCategory', e.target.value)}
        className="bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-1.5 text-xs text-white
          focus:outline-none focus:border-cyan-500/50 transition-all"
      >
        <option value="">全部类型</option>
        <option value="工业企业">工业企业</option>
        <option value="公建建筑">公建建筑</option>
      </select>

      {subCategoryOptions.length > 0 && (
        <select
          value={filters.subCategory}
          onChange={(e) => update('subCategory', e.target.value)}
          className="bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-1.5 text-xs text-white
            focus:outline-none focus:border-cyan-500/50 transition-all max-w-[130px]"
        >
          <option value="">全部细分</option>
          {subCategoryOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      <select
        value={filters.probabilityLevel}
        onChange={(e) => update('probabilityLevel', e.target.value)}
        className="bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-1.5 text-xs text-white
          focus:outline-none focus:border-cyan-500/50 transition-all"
      >
        <option value="">全部等级</option>
        <option value="高">高概率</option>
        <option value="中等">中概率</option>
        <option value="低">低概率</option>
      </select>

      <select
        value={filters.detectionStatus}
        onChange={(e) => update('detectionStatus', e.target.value)}
        className="bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-1.5 text-xs text-white
          focus:outline-none focus:border-cyan-500/50 transition-all"
      >
        <option value="">全部状态</option>
        <option value="pending">待识别</option>
        <option value="detected">已识别</option>
        <option value="no_result">无结果</option>
      </select>

      <select
        value={filters.hasCoolingTower}
        onChange={(e) => update('hasCoolingTower', e.target.value)}
        className="bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-1.5 text-xs text-white
          focus:outline-none focus:border-cyan-500/50 transition-all"
      >
        <option value="">冷却塔</option>
        <option value="yes">有</option>
        <option value="no">无</option>
      </select>

      <span className="text-[10px] text-slate-500 bg-slate-800/40 px-2 py-1 rounded-md whitespace-nowrap">
        {totalCount.toLocaleString()} 条
      </span>

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 transition-colors"
        >
          <X className="w-3 h-3" />
          清除
        </button>
      )}
    </div>
  );
}
