import type { ScanDetection } from '../../types/pipeline.ts';
import { getCandidateWorkflowState } from './candidateWorkflow.ts';

interface Props {
  detections: ScanDetection[];
  onApprove: () => void;
  onReject: () => void;
  onBindEnterprise: () => void;
}

export default function CandidateActionBar({
  detections,
  onApprove,
  onReject,
  onBindEnterprise,
}: Props) {
  if (detections.length === 0) {
    return null;
  }

  const reviewableCount = detections.filter((item) => getCandidateWorkflowState(item) === 'pending_review').length;
  const rejectableCount = detections.filter((item) => getCandidateWorkflowState(item) !== 'rejected').length;
  const bindableCount = detections.filter((item) => getCandidateWorkflowState(item) === 'needs_binding').length;

  if (reviewableCount === 0 && rejectableCount === 0 && bindableCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div className="text-xs text-slate-400">
        候选审核
        <span className="ml-2 text-slate-500">
          当前选中 {detections.length} 张
        </span>
      </div>
      <button
        onClick={onApprove}
        disabled={reviewableCount === 0}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        批量通过 {reviewableCount > 0 ? `(${reviewableCount})` : ''}
      </button>
      <button
        onClick={onReject}
        disabled={rejectableCount === 0}
        className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        批量驳回 {rejectableCount > 0 ? `(${rejectableCount})` : ''}
      </button>
      <button
        onClick={onBindEnterprise}
        disabled={bindableCount === 0}
        className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        去绑定企业 {bindableCount > 0 ? `(${bindableCount})` : ''}
      </button>
      <span className="text-xs text-slate-500">
        区域截图需要先审核，再绑定企业，最后上传标注图。
      </span>
    </div>
  );
}
