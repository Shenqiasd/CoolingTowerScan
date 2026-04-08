import { CheckCircle2, Upload, XCircle, Minus } from 'lucide-react';
import type { ScanDetection } from '../../types/pipeline';

interface Props {
  status: ScanDetection['uploadStatus'];
}

export default function UploadStatusBadge({ status }: Props) {
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" title="已上传" />;
  if (status === 'uploading') return <Upload className="w-3.5 h-3.5 text-cyan-400 animate-pulse" title="上传中" />;
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-400" title="上传失败" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" title="未上传" />;
}
