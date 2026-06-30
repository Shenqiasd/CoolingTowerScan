import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';

const TEST_ENV: AppEnv = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: null,
  appAccessUsername: 'user',
  appAccessPassword: 'password',
  appJwtSecret: 'app-jwt-secret',
  appAuthUserId: '11111111-1111-4111-8111-111111111111',
};

describe('app auth routes', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('issues an app token and accepts it on protected auth routes', async () => {
    app = buildApp({ env: TEST_ENV });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        username: 'user',
        password: 'password',
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const body = loginResponse.json() as { token: string; user: { id: string } };
    expect(body.token).toBeTruthy();
    expect(body.user.id).toBe(TEST_ENV.appAuthUserId);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        Authorization: `Bearer ${body.token}`,
      },
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual({
      user: {
        id: TEST_ENV.appAuthUserId,
        role: 'authenticated',
      },
    });
  });

  it('rejects invalid app credentials', async () => {
    app = buildApp({ env: TEST_ENV });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        username: 'user',
        password: 'wrong',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('APP_AUTH_INVALID_CREDENTIALS');
  });
});
