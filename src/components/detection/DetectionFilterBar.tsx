import type { DetectionFilters } from '../../types/pipeline';
import type { ScanDetection } from '../../types/pipeline';

interface Props {
  filters: DetectionFilters;
  onChange: (f: DetectionFilters) => void;
  detections: ScanDetection[];
}

export default function DetectionFilterBar({ filters, onChange, detections }: Props) {
  const addressLabels = [...new Set(detections.map(d => d.addressLabel).filter(Boolean))] as string[];

  const set = (patch: Partial<DetectionFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-800/60 border-b border-slate-700 text-xs">
      {/* Detection status */}
      <select
        value={filters.detectionStatus}
        onChange={e => set({ detectionStatus: e.target.value as DetectionFilters['detectionStatus'] })}
        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200"
      >
        <option value="">全部状态</option>
        <option value="pending">待识别</option>
        <option value="detected">已识别</option>
        <option value="no_result">无结果</option>
        <option value="error">失败</option>
      </select>

      {/* Has tower */}
      <select
        value={filters.hasTower}
        onChange={e => set({ hasTower: e.target.value as DetectionFilters['hasTower'] })}
        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200"
      >
        <option value="">有无冷却塔</option>
        <option value="yes">有塔</option>
        <option value="no">无塔</option>
      </select>

      {/* Source */}
      <select
        value={filters.source}
        onChange={e => set({ source: e.target.value as DetectionFilters['source'] })}
        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200"
      >
        <option value="">全部来源</option>
        <option value="area">区域截图</option>
        <option value="address">地址搜索</option>
      </select>

      {/* Address label */}
      {addressLabels.length > 0 && (
        <select
          value={filters.addressLabel}
          onChange={e => set({ addressLabel: e.target.value })}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200 max-w-[160px]"
        >
          <option value="">全部地址</option>
          {addressLabels.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      )}

      {/* Confidence range */}
      <div className="flex items-center gap-1.5 text-slate-400">
        <span>置信度</span>
        <input
          type="number" min={0} max={1} step={0.05}
          value={filters.confidenceMin}
          onChange={e => set({ confidenceMin: parseFloat(e.target.value) || 0 })}
          className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-slate-200"
        />
        <span>~</span>
        <input
          type="number" min={0} max={1} step={0.05}
          value={filters.confidenceMax}
          onChange={e => set({ confidenceMax: parseFloat(e.target.value) || 1 })}
          className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-slate-200"
        />
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange({ detectionStatus: '', hasTower: '', confidenceMin: 0, confidenceMax: 1, source: '', addressLabel: '' })}
        className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
      >
        重置
      </button>
    </div>
  );
}
