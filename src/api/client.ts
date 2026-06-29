import { supabase } from '../lib/supabase';

const DEFAULT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const APP_AUTH_TOKEN_KEY = 'coolingTowerScan.appAuthToken';
const APP_AUTH_EXPIRES_AT_KEY = 'coolingTowerScan.appAuthExpiresAt';

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

export function getStoredAppAuthToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = window.localStorage.getItem(APP_AUTH_TOKEN_KEY);
  const expiresAt = Number(window.localStorage.getItem(APP_AUTH_EXPIRES_AT_KEY) ?? 0);
  if (!token || !Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) {
    window.localStorage.removeItem(APP_AUTH_TOKEN_KEY);
    window.localStorage.removeItem(APP_AUTH_EXPIRES_AT_KEY);
    return null;
  }

  return token;
}

export function storeAppAuthToken(token: string, expiresAt: number) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(APP_AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(APP_AUTH_EXPIRES_AT_KEY, String(expiresAt));
}

export function clearAppAuthToken() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(APP_AUTH_TOKEN_KEY);
  window.localStorage.removeItem(APP_AUTH_EXPIRES_AT_KEY);
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

  const appAuthToken = getStoredAppAuthToken();
  if (appAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${appAuthToken}`);
  }

  if (!headers.has('Authorization')) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        headers.set('Authorization', `Bearer ${data.session.access_token}`);
      }
    } catch {
      // Leave auth unset when no Supabase session is available.
    }
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
