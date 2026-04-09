const API_URL_KEY = 'detection_api_url';
const DEFAULT_URL = 'http://localhost:8000';

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

export async function detectImage(
  imageSource: Blob | string,
  filename: string,
  apiUrl?: string,
  conf?: number,
): Promise<DetectionApiResult> {
  const url = apiUrl || getDetectionApiUrl();
  const confParam = conf !== undefined ? `?conf=${conf}` : '';

  // If it's a remote URL, let the server download it (avoids CORS)
  if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
    const response = await fetch(`${url}/detect/url${confParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageSource }),
    });
    if (!response.ok) throw new Error(`检测失败: ${response.status} ${response.statusText}`);
    return response.json();
  }

  // Blob: upload directly
  const formData = new FormData();
  formData.append('image', imageSource as Blob, filename);
  const response = await fetch(`${url}/detect${confParam}`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`检测失败: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function checkHealth(apiUrl?: string): Promise<boolean> {
  const url = apiUrl || getDetectionApiUrl();
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
