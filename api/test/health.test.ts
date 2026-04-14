import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';

const TEST_ENV: AppEnv = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: 'test-jwt-secret',
};

describe('GET /health', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns the api service health payload', async () => {
    app = buildApp({ env: TEST_ENV });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'api',
    });
  });
});
