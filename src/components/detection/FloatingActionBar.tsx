import { Radar, Trash2, Upload, Link } from 'lucide-react';

interface Props {
  selectedCount: number;
  onDetect: () => void;
  onUpload: () => void;
  onDelete: () => void;
  onLinkEnterprise: () => void;
  isDetecting: boolean;
}

export default function FloatingActionBar({ selectedCount, onDetect, onUpload, onDelete, onLinkEnterprise, isDetecting }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 shadow-2xl">
      <span className="text-xs text-slate-400 mr-2">已选 {selectedCount} 张</span>
      <button
        onClick={onDetect}
        disabled={isDetecting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
      >
        <Radar className="w-3.5 h-3.5" />
        批量识别
      </button>
      <button
        onClick={onUpload}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        批量上传
      </button>
      <button
        onClick={onLinkEnterprise}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
      >
        <Link className="w-3.5 h-3.5" />
        关联企业
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-medium transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        移除
      </button>
    </div>
  );
}
