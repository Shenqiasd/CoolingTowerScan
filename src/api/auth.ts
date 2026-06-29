import { apiRequest } from './client';

export interface LoginResult {
  token: string;
  expiresAt: number;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export function loginWithPassword(username: string, password: string) {
  return apiRequest<LoginResult>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
