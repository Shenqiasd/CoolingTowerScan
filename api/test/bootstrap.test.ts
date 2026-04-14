import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';

const TEST_JWT_SECRET = 'test-jwt-secret';

const TEST_ENV: AppEnv = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: TEST_JWT_SECRET,
};

async function createToken(userId: string) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));
}

describe('api bootstrap plugins', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('keeps the health endpoint available after plugin registration', async () => {
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

  it('returns bootstrap metadata without requiring auth', async () => {
    app = buildApp({ env: TEST_ENV });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/bootstrap',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      auth: {
        userId: null,
        role: 'anonymous',
        isAuthenticated: false,
      },
      services: {
        api: 'self',
        supabaseUrl: TEST_ENV.supabaseUrl,
      },
      dictionaries: {
        candidateStatuses: ['new', 'under_review', 'approved', 'rejected', 'needs_info', 'converted'],
        leadStatuses: ['new', 'pending_confirmation', 'qualified', 'disqualified', 'on_hold', 'converted'],
        leadConfirmationRoles: ['sales', 'technical'],
        leadConfirmationStatuses: ['pending', 'confirmed', 'rejected'],
        projectStageCodes: ['prospecting', 'qualification', 'survey', 'proposal', 'bidding', 'execution', 'commissioning', 'operations'],
        projectStageStatuses: ['not_started', 'in_progress', 'blocked', 'pending_approval', 'completed', 'waived'],
        projectWorkflowStatuses: ['active', 'blocked', 'on_hold', 'completed', 'cancelled'],
      },
    });
  });

  it('returns a stable error envelope for unauthenticated protected mutations', async () => {
    app = buildApp({
      env: TEST_ENV,
      registerRoutes(instance) {
        instance.post('/test/protected', { preHandler: instance.requireAuth }, async () => {
          return { ok: true };
        });
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test/protected',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
        details: {},
      },
    });
  });

  it('standardizes auth and audit context for authenticated handlers', async () => {
    app = buildApp({
      env: TEST_ENV,
      registerRoutes(instance) {
        instance.post('/test/protected', { preHandler: instance.requireAuth }, async (request) => {
          return {
            userId: request.auth.userId,
            role: request.auth.role,
            isAuthenticated: request.auth.isAuthenticated,
            actorUserId: request.audit.actorUserId,
            actorSource: request.audit.actorSource,
          };
        });
      },
    });

    const token = await createToken('user-123');
    const response = await app.inject({
      method: 'POST',
      url: '/test/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: 'user-123',
      role: 'authenticated',
      isAuthenticated: true,
      actorUserId: 'user-123',
      actorSource: 'api',
    });
  });

  it('reflects authenticated user context in bootstrap metadata', async () => {
    app = buildApp({ env: TEST_ENV });

    const token = await createToken('user-123');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/bootstrap',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      auth: {
        userId: 'user-123',
        role: 'authenticated',
        isAuthenticated: true,
      },
    });
  });
});
