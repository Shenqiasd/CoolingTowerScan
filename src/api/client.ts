import { supabase } from '../lib/supabase';

const DEFAULT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getApiBaseUrl() {
  return DEFAULT_API_BASE_URL;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiClientError(0, 'API_BASE_URL_MISSING', 'API base URL is not configured.', {});
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${data.session.access_token}`);
    }
  } catch {
    // Leave auth unset when no Supabase session is available.
  }

  const response = await fetch(new URL(path, `${baseUrl}/`).toString(), {
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = payload && typeof payload === 'object'
      ? (payload as {
          error?: {
            code?: string;
            message?: string;
            details?: unknown;
          };
        }).error
      : undefined;
    throw new ApiClientError(
      response.status,
      error?.code || 'API_REQUEST_FAILED',
      error?.message || 'API request failed.',
      error?.details || {},
    );
  }

  return payload as T;
}
