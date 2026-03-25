import { Search, X } from 'lucide-react';
import type { EnterpriseFilters } from '../types/enterprise';

interface FilterBarProps {
  filters: EnterpriseFilters;
  onChange: (filters: EnterpriseFilters) => void;
  totalCount: number;
}

export default function FilterBar({ filters, onChange, totalCount }: FilterBarProps) {
  function update(key: keyof EnterpriseFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function clearAll() {
    onChange({
      probabilityLevel: '',
      detectionStatus: '',
      industryCategory: '',
      searchText: '',
      hasCoolingTower: '',
    });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-[240px]">
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
        value={filters.probabilityLevel}
        onChange={(e) => update('probabilityLevel', e.target.value)}
        className="bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-1.5 text-xs text-white
          focus:outline-none focus:border-cyan-500/50 transition-all"
      >
        <option value="">全部等级</option>
        <option value="高">高概率</option>
        <option value="中">中概率</option>
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
