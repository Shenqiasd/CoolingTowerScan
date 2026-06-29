const API_URL_KEY = 'detection_api_url';
const ENV_URL = (import.meta.env.VITE_DETECTION_API_URL || '').trim();
const DEFAULT_URL = ENV_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

export function getDetectionApiUrl(): string {
  return localStorage.getItem(API_URL_KEY) || DEFAULT_URL;
}

export function setDetectionApiUrl(url: string): void {
  localStorage.setItem(API_URL_KEY, url);
}

export interface DetectionApiResult {
  has_cooling_tower: boolean;
  count: number;
  confidence: number;
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    center_x: number;
    center_y: number;
    width: number;
    height: number;
    confidence: number;
    class_name: string;
  }>;
}

export interface DetectionHealthStatus {
  ok: boolean;
  status?: number;
  message: string;
  customWeights?: boolean;
  weightsPath?: string;
}

function formatServerDetail(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const detail = value as Record<string, unknown>;
    if (typeof detail.message === 'string') return detail.message;
    if (typeof detail.detail === 'string') return detail.detail;
    if (detail.detail && typeof detail.detail === 'object') {
      return formatServerDetail(detail.detail);
    }
    return JSON.stringify(detail);
  }
  return '';
}

async function readResponseDetail(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      return formatServerDetail(body.detail ?? body);
    }
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function throwDetectionError(response: Response): Promise<never> {
  const detail = await readResponseDetail(response);
  const suffix = detail ? `: ${detail}` : '';
  throw new Error(`检测失败: ${response.status} ${response.statusText}${suffix}`);
}

export async function detectImage(
  imageSource: Blob | string,
  filename: string,
  apiUrl?: string,
  conf?: number,
): Promise<DetectionApiResult> {
  const url = apiUrl || getDetectionApiUrl();
  if (!url) {
    throw new Error('检测服务地址未配置');
  }
  const confParam = conf !== undefined ? `?conf=${conf}` : '';

  // If it's a remote URL, let the server download it (avoids CORS)
  if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
    const response = await fetch(`${url}/detect/url${confParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageSource }),
    });
    if (!response.ok) await throwDetectionError(response);
    return response.json();
  }

  // Blob: upload directly
  const formData = new FormData();
  formData.append('image', imageSource as Blob, filename);
  const response = await fetch(`${url}/detect${confParam}`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) await throwDetectionError(response);
  return response.json();
}

export async function getHealthStatus(apiUrl?: string): Promise<DetectionHealthStatus> {
  const url = apiUrl || getDetectionApiUrl();
  if (!url) {
    return { ok: false, message: '检测服务地址未配置' };
  }
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const detail = body && typeof body === 'object' && 'detail' in body
      ? (body as { detail: unknown }).detail
      : body;
    const detailRecord = detail && typeof detail === 'object'
      ? detail as Record<string, unknown>
      : {};
    const message = formatServerDetail(detail) || (res.ok ? 'ok' : res.statusText || '检测服务异常');
    return {
      ok: res.ok,
      status: res.status,
      message,
      customWeights: typeof detailRecord.custom_weights === 'boolean'
        ? detailRecord.custom_weights
        : undefined,
      weightsPath: typeof detailRecord.weights_path === 'string'
        ? detailRecord.weights_path
        : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkHealth(apiUrl?: string): Promise<boolean> {
  return (await getHealthStatus(apiUrl)).ok;
}
