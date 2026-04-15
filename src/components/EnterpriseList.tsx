import { useRef } from 'react';
import { AlertCircle, ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Enterprise } from '../types/enterprise';
import type { SortField, SortDirection } from '../hooks/useEnterprises';
import { getEnterpriseSourceLabel } from '../utils/enterpriseProvenance';

interface EnterpriseListProps {
  enterprises: Enterprise[];
  selectedId: string | null;
  onSelect: (enterprise: Enterprise) => void;
  loading: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField, direction: SortDirection) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  width: string;
  unit?: string;
  sticky?: boolean;
  sortable?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'enterprise_name', label: '企业名称', width: 'min-w-[200px] max-w-[260px]', sticky: true, sortable: true },
  { key: 'major_category', label: '大类', width: 'w-[76px]', sortable: true },
  { key: 'sub_category', label: '细分类型', width: 'w-[90px]', sortable: true },
  { key: 'probability_level', label: '概率', width: 'w-[52px]', sortable: true },
  { key: 'detection_confidence', label: '置信度', width: 'w-[64px]', sortable: true },
  { key: 'cooling_tower_count', label: '冷却塔', width: 'w-[60px]', unit: '台', sortable: true },
  { key: 'detected_tower_avg_area_m2', label: '平均塔面积', width: 'w-[90px]', unit: 'm\u00B2', sortable: true },
  { key: 'detected_tower_max_area_m2', label: '最大塔面积', width: 'w-[90px]', unit: 'm\u00B2', sortable: true },
  { key: 'estimated_building_area', label: '建筑面积', width: 'w-[90px]', unit: 'm\u00B2', sortable: true },
  { key: 'unit_cooling_load', label: '单位冷负荷', width: 'w-[90px]', unit: 'W/m\u00B2', sortable: true },
  { key: 'peak_cooling_load', label: '峰值冷负荷', width: 'w-[90px]', unit: 'kW', sortable: true },
  { key: 'total_cooling_capacity_rt', label: '总冷量', width: 'w-[80px]', unit: 'RT', sortable: true },
  { key: 'chiller_count', label: '冷机数量', width: 'w-[72px]', unit: '台', sortable: true },
  { key: 'single_unit_capacity_rt', label: '单机冷量', width: 'w-[90px]', unit: 'RT/台', sortable: true },
  { key: 'single_unit_rated_power_kw', label: '单机功率', width: 'w-[90px]', unit: 'kW/台', sortable: true },
  { key: 'cooling_station_rated_power_kw', label: '站额定功率', width: 'w-[100px]', unit: 'kW', sortable: true },
];

function formatValue(value: unknown, key: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (key === 'peak_cooling_load' || key === 'total_cooling_capacity_rt') return value.toFixed(1);
    if (key === 'composite_score') return value.toFixed(1);
    if (key === 'detection_confidence') return value > 0 ? `${(value * 100).toFixed(0)}%` : '-';
    return value.toLocaleString();
  }
  return String(value);
}

function getRowBorderColor(enterprise: Enterprise): string {
  if (enterprise.has_cooling_tower) return 'border-l-emerald-500';
  if (enterprise.detection_status === 'detected') return 'border-l-amber-500';
  if (enterprise.detection_status === 'no_result') return 'border-l-slate-600';
  return 'border-l-blue-500/50';
}

function getRowBgTint(enterprise: Enterprise, isSelected: boolean): string {
  if (isSelected) return 'bg-cyan-500/10';
  if (enterprise.has_cooling_tower) return 'bg-emerald-950/20';
  if (enterprise.detection_status === 'no_result') return 'opacity-60';
  return '';
}

function getCellColor(key: string, value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'number') return 'text-slate-300';

  if (key === 'cooling_station_rated_power_kw') {
    if (value > 300) return 'text-rose-400';
    if (value >= 150) return 'text-amber-400';
    return 'text-slate-300';
  }
  if ((key === 'detected_tower_avg_area_m2' || key === 'detected_tower_max_area_m2') && value > 0) {
    if (value >= 30) return 'text-cyan-400';
    if (value >= 15) return 'text-emerald-400';
    return 'text-slate-300';
  }
  if (key === 'detection_confidence') {
    if (value >= 0.7) return 'text-emerald-400 font-semibold';
    if (value >= 0.4) return 'text-amber-400';
    if (value > 0) return 'text-slate-400';
    return 'text-slate-600';
  }
  if (key === 'estimated_building_area' && value > 15000) return 'text-cyan-400';
  if (key === 'cooling_tower_count' && value > 0) return 'text-emerald-400 font-semibold';

  return 'text-slate-300';
}

function SortIcon({ columnKey, sortField, sortDirection }: {
  columnKey: string;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (columnKey !== sortField) {
    return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
  }
  return sortDirection === 'asc'
    ? <ChevronUp className="w-3 h-3 text-cyan-400" />
    : <ChevronDown className="w-3 h-3 text-cyan-400" />;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | 'ellipsis')[] = [];
  pages.push(0);
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 4) pages.push('ellipsis');
  pages.push(total - 1);
  return pages;
}

export default function EnterpriseList({
  enterprises,
  selectedId,
  onSelect,
  loading,
  page,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
  sortField,
  sortDirection,
  onSort,
}: EnterpriseListProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  function handleHeaderClick(key: string) {
    if (key === sortField) {
      onSort(key as SortField, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key as SortField, 'desc');
    }
  }

  function handlePageChange(p: number) {
    onPageChange(p);
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading && enterprises.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!loading && enterprises.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">暂无数据</p>
          <p className="text-xs text-slate-500">请导入CSV企业清单</p>
        </div>
      </div>
    );
  }

  const rangeStart = page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="h-full flex flex-col">
      <div ref={tableRef} className="flex-1 overflow-auto custom-scrollbar relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/40 z-30 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-900 border-b border-slate-700/50">
              <th
                onClick={() => handleHeaderClick(COLUMNS[0].key)}
                className={`group text-left text-[10px] font-semibold uppercase tracking-wider
                  px-3 py-2.5 sticky left-0 bg-slate-900 z-20 min-w-[200px] max-w-[260px]
                  cursor-pointer select-none transition-colors
                  ${sortField === COLUMNS[0].key ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <div className="flex items-center gap-1">
                  {COLUMNS[0].label}
                  <SortIcon columnKey={COLUMNS[0].key} sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              {COLUMNS.slice(1).map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleHeaderClick(col.key)}
                  className={`group text-right text-[10px] font-semibold uppercase tracking-wider
                    px-3 py-2.5 whitespace-nowrap ${col.width}
                    ${col.sortable ? 'cursor-pointer select-none' : ''}
                    transition-colors
                    ${sortField === col.key ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <div className="flex items-center justify-end gap-1">
                    <div>
                      <div>{col.label}</div>
                      {col.unit && (
                        <div className={`text-[9px] font-normal normal-case ${sortField === col.key ? 'text-cyan-500/60' : 'text-slate-500'}`}>
                          {col.unit}
                        </div>
                      )}
                    </div>
                    {col.sortable && (
                      <SortIcon columnKey={col.key} sortField={sortField} sortDirection={sortDirection} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              <td colSpan={COLUMNS.length} className="h-px p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              </td>
            </tr>
          </thead>
          <tbody>
            {enterprises.map((enterprise, idx) => {
              const isSelected = selectedId === enterprise.id;
              const borderColor = getRowBorderColor(enterprise);
              const bgTint = getRowBgTint(enterprise, isSelected);

              return (
                <tr
                  key={enterprise.id}
                  onClick={() => onSelect(enterprise)}
                  className={`border-b border-slate-800/40 border-l-2 cursor-pointer transition-all duration-150
                    ${borderColor} ${bgTint}
                    ${isSelected ? '' : 'hover:bg-white/[0.03]'}
                    ${idx % 2 === 1 ? 'bg-slate-900/20' : ''}`}
                >
                  <td className="px-3 py-2.5 sticky left-0 z-[5] bg-slate-950 min-w-[200px] max-w-[260px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        enterprise.has_cooling_tower ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' :
                        enterprise.detection_status === 'detected' ? 'bg-amber-400 shadow-sm shadow-amber-400/50' :
                        enterprise.detection_status === 'no_result' ? 'bg-slate-600' :
                        'bg-blue-400/60'
                      }`} />
                      <span className={`font-medium truncate ${
                        enterprise.detection_status === 'no_result' ? 'text-slate-500' : 'text-white'
                      }`}>
                        {enterprise.enterprise_name}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400">
                        来源：{getEnterpriseSourceLabel(enterprise.match_dimension_details)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right w-[76px]">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                      enterprise.major_category === '工业企业'
                        ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20'
                        : 'bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/20'
                    }`}>
                      {enterprise.major_category || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right w-[90px]">
                    <span className="text-[10px] text-slate-400 truncate block text-right">
                      {enterprise.sub_category || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      enterprise.probability_level === '高'
                        ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/20'
                        : enterprise.probability_level === '中等'
                        ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/20'
                        : 'bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/20'
                    }`}>
                      {enterprise.probability_level}
                    </span>
                  </td>
                  {COLUMNS.slice(4).map((col) => {
                    const val = enterprise[col.key as keyof Enterprise];
                    const cellColor = getCellColor(col.key, val);
                    return (
                      <td key={col.key} className={`px-3 py-2.5 text-right tabular-nums ${col.width} ${cellColor}`}>
                        {formatValue(val, col.key)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 border-t border-slate-700/40 bg-slate-900/80 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            {rangeStart}-{rangeEnd} / {totalCount.toLocaleString()} 条
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700/50 rounded px-1.5 py-0.5 text-xs text-slate-300
                focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(0)}
            disabled={page === 0}
            className="p-1.5 rounded hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed
              text-slate-400 hover:text-white transition-colors"
            title="第一页"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 0}
            className="p-1.5 rounded hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed
              text-slate-400 hover:text-white transition-colors"
            title="上一页"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {getPageNumbers(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1 text-slate-600 text-xs">...</span>
            ) : (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                  p === page
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {p + 1}
              </button>
            )
          )}

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed
              text-slate-400 hover:text-white transition-colors"
            title="下一页"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handlePageChange(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed
              text-slate-400 hover:text-white transition-colors"
            title="最后一页"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
