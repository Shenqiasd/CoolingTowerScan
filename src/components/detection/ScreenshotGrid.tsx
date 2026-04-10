import { useState, useCallback } from 'react';
import {
  Grid3X3, List, CheckSquare, Square,
  CheckCircle2, XCircle, AlertCircle, Clock,
} from 'lucide-react';
import type { ScanDetection, CaptureResult } from '../../types/pipeline';
import { findDetectionForScreenshot, getScreenshotIdentity } from '../../utils/screenshotIdentity';
import UploadStatusBadge from './UploadStatusBadge';

interface Props {
  screenshots: CaptureResult[];
  detections: ScanDetection[];
  selected: Set<string>;
  onSelect: (screenshotIdentity: string, checked: boolean) => void;
  onSelectAll: (screenshotIdentities: string[]) => void;
  onClearSelection: () => void;
  onReview: (detection: ScanDetection) => void;
  confThreshold: number;
}

type Category = 'tower' | 'suspicious' | 'none' | 'pending' | 'error';

function getCategory(det: ScanDetection | undefined, confThreshold: number): Category {
  if (!det) return 'pending';
  if (det.error) return 'error';
  if (det.hasCoolingTower && det.confidence >= confThreshold) return 'tower';
  if (det.hasCoolingTower && det.confidence >= 0.1) return 'suspicious';
  return 'none';
}

function DetectionStatusBadge({ category }: { category: Category }) {
  const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium';
  const styles: Record<Category, string> = {
    tower:      'bg-emerald-900/60 text-emerald-300',
    suspicious: 'bg-amber-900/60 text-amber-300',
    none:       'bg-slate-700/80 text-slate-300',
    pending:    'bg-gray-800/80 text-gray-400',
    error:      'bg-red-900/60 text-red-300',
  };
  const dots: Record<Category, string> = {
    tower:      'bg-emerald-400',
    suspicious: 'bg-amber-400',
    none:       'bg-slate-400',
    pending:    'bg-gray-500',
    error:      'bg-red-400',
  };
  const icons: Record<Category, React.ReactNode> = {
    tower:      <CheckCircle2 className="w-3 h-3" />,
    suspicious: <AlertCircle className="w-3 h-3" />,
    none:       <XCircle className="w-3 h-3" />,
    pending:    <Clock className="w-3 h-3" />,
    error:      <XCircle className="w-3 h-3" />,
  };
  const labels: Record<Category, string> = {
    tower: '有塔', suspicious: '疑似', none: '无塔', pending: '待识别', error: '失败',
  };
  return (
    <span className={`${base} ${styles[category]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[category]}`} />
      {icons[category]}
      {labels[category]}
    </span>
  );
}

const cardBorderColor: Record<Category, string> = {
  tower:      'border-emerald-600',
  suspicious: 'border-amber-500',
  none:       'border-slate-700',
  pending:    'border-slate-700',
  error:      'border-red-600',
};

export default function ScreenshotGrid({
  screenshots,
  detections,
  selected,
  onSelect,
  onSelectAll,
  onClearSelection,
  onReview,
  confThreshold,
}: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const allScreenshotIdentities = screenshots.map((s) => getScreenshotIdentity(s));
  const allSelected = allScreenshotIdentities.length > 0 && allScreenshotIdentities.every((id) => selected.has(id));
  const someSelected = !allSelected && allScreenshotIdentities.some((id) => selected.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onClearSelection();
    } else {
      onSelectAll(allScreenshotIdentities);
    }
  }, [allSelected, allScreenshotIdentities, onSelectAll, onClearSelection]);

  const counts: Record<Category, number> = { tower: 0, suspicious: 0, none: 0, pending: 0, error: 0 };
  for (const s of screenshots) {
    counts[getCategory(findDetectionForScreenshot(detections, s), confThreshold)]++;
  }

  const summaryItems: { cat: Category; label: string; color: string }[] = [
    { cat: 'tower',      label: '有塔',   color: 'text-emerald-400' },
    { cat: 'suspicious', label: '疑似',   color: 'text-amber-400'   },
    { cat: 'none',       label: '无塔',   color: 'text-slate-400'   },
    { cat: 'pending',    label: '待识别', color: 'text-gray-500'    },
    { cat: 'error',      label: '失败',   color: 'text-red-400'     },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
            title={allSelected ? '取消全选' : '全选'}
          >
            {allSelected || someSelected ? (
              <CheckSquare className={`w-4 h-4 ${allSelected ? 'text-cyan-400' : 'text-cyan-400/50'}`} />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span className="text-xs text-slate-400">
              {selected.size > 0 ? `已选 ${selected.size}` : '全选'}
            </span>
          </button>

          <div className="flex items-center gap-3 text-xs">
            {summaryItems.map(({ cat, label, color }) =>
              counts[cat] > 0 ? (
                <span key={cat} className={`${color} font-medium`}>
                  {label} {counts[cat]}
                </span>
              ) : null
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="网格视图"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="列表视图"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {screenshots.map(shot => {
            const shotIdentity = getScreenshotIdentity(shot);
            const det = findDetectionForScreenshot(detections, shot);
            const cat = getCategory(det, confThreshold);
            const isSelected = selected.has(shotIdentity);
            const imgSrc = shot.dataUrl || shot.publicUrl || det?.annotatedUrl || det?.publicUrl || det?.imageUrl || '';
            const shortName = shot.filename.length > 20
              ? shot.filename.slice(0, 9) + '…' + shot.filename.slice(-8)
              : shot.filename;

            return (
              <div
                key={shotIdentity}
                className={`relative flex flex-col rounded-lg border bg-slate-800 overflow-hidden
                  ${cardBorderColor[cat]}
                  ${isSelected ? 'ring-2 ring-cyan-500' : ''}
                  transition-all`}
              >
                {/* Thumbnail */}
                <div
                  className={`relative aspect-video bg-slate-900 overflow-hidden ${det ? 'cursor-pointer' : ''}`}
                  onClick={() => det && onReview(det)}
                >
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={shot.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                      无图像
                    </div>
                  )}

                  {/* Top-left: checkbox */}
                  <button
                    className="absolute top-1 left-1 z-10 p-0.5 rounded bg-slate-900/70 hover:bg-slate-900 transition-colors"
                    onClick={e => { e.stopPropagation(); onSelect(shotIdentity, !isSelected); }}
                    title={isSelected ? '取消选择' : '选择'}
                  >
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                      : <Square className="w-4 h-4 text-slate-400" />
                    }
                  </button>

                  {/* Top-right: detection status */}
                  <div className="absolute top-1 right-1 z-10">
                    <DetectionStatusBadge category={cat} />
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-2 py-1.5 flex flex-col gap-0.5">
                  <span className="text-xs text-slate-200 font-mono truncate" title={shot.filename}>
                    {shortName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {shot.lng.toFixed(4)}, {shot.lat.toFixed(4)}
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <UploadStatusBadge status={det?.uploadStatus} />
                    {det && det.hasCoolingTower && (
                      <span className="text-xs text-slate-400">
                        {(det.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                <th className="w-8 px-2 py-2 text-center">
                  <button onClick={handleSelectAll} title={allSelected ? '取消全选' : '全选'}>
                    {allSelected || someSelected ? (
                      <CheckSquare className={`w-4 h-4 ${allSelected ? 'text-cyan-400' : 'text-cyan-400/50'}`} />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="w-16 px-2 py-2 text-left">缩略图</th>
                <th className="px-2 py-2 text-left">文件名</th>
                <th className="px-2 py-2 text-left">来源</th>
                <th className="px-2 py-2 text-left">地址</th>
                <th className="px-2 py-2 text-left">状态</th>
                <th className="px-2 py-2 text-right">置信度</th>
                <th className="px-2 py-2 text-center">上传</th>
                <th className="px-2 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {screenshots.map((shot, idx) => {
                const shotIdentity = getScreenshotIdentity(shot);
                const det = findDetectionForScreenshot(detections, shot);
                const cat = getCategory(det, confThreshold);
                const isSelected = selected.has(shotIdentity);
                const imgSrc = shot.dataUrl || shot.publicUrl || det?.annotatedUrl || det?.publicUrl || det?.imageUrl || '';

                return (
                  <tr
                    key={shotIdentity}
                    className={`border-b border-slate-700/50 transition-colors
                      ${isSelected ? 'bg-cyan-900/20' : idx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/40'}
                      hover:bg-slate-700/30`}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => onSelect(shotIdentity, !isSelected)}>
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                          : <Square className="w-4 h-4 text-slate-500" />
                        }
                      </button>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-2 py-1.5">
                      <div className="w-14 h-9 bg-slate-900 rounded overflow-hidden">
                        {imgSrc ? (
                          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">—</div>
                        )}
                      </div>
                    </td>

                    {/* Filename */}
                    <td className="px-2 py-1.5 font-mono max-w-[160px]">
                      <span className="truncate block" title={shot.filename}>{shot.filename}</span>
                      <span className="text-slate-500 text-xs">
                        {shot.lng.toFixed(4)}, {shot.lat.toFixed(4)}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="px-2 py-1.5 text-slate-400">
                      {det?.source === 'address' ? '地址' : det?.source === 'area' ? '区域' : '—'}
                    </td>

                    {/* Address label */}
                    <td className="px-2 py-1.5 max-w-[140px]">
                      <span className="truncate block text-slate-400" title={shot.addressLabel}>
                        {shot.addressLabel || det?.addressLabel || '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-2 py-1.5">
                      <DetectionStatusBadge category={cat} />
                    </td>

                    {/* Confidence */}
                    <td className="px-2 py-1.5 text-right">
                      {det && det.hasCoolingTower
                        ? <span className={cat === 'tower' ? 'text-emerald-400' : 'text-amber-400'}>
                            {(det.confidence * 100).toFixed(0)}%
                          </span>
                        : <span className="text-slate-600">—</span>
                      }
                    </td>

                    {/* Upload status */}
                    <td className="px-2 py-1.5 text-center">
                      <UploadStatusBadge status={det?.uploadStatus} />
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1.5 text-center">
                      {det ? (
                        <button
                          onClick={() => onReview(det)}
                          className="px-2 py-0.5 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                        >
                          查看
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {screenshots.length === 0 && (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
          暂无截图
        </div>
      )}
    </div>
  );
}
