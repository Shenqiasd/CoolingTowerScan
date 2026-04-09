import { CheckCircle2, Upload, XCircle, Minus } from 'lucide-react';
import type { ScanDetection } from '../../types/pipeline';

interface Props {
  status: ScanDetection['uploadStatus'];
}

export default function UploadStatusBadge({ status }: Props) {
  if (status === 'done') return <span title="已上传"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></span>;
  if (status === 'uploading') return <span title="上传中"><Upload className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /></span>;
  if (status === 'failed') return <span title="上传失败"><XCircle className="w-3.5 h-3.5 text-red-400" /></span>;
  return <span title="未上传"><Minus className="w-3.5 h-3.5 text-slate-500" /></span>;
}
