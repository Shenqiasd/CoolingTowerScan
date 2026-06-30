import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';

import { APP_JWT_ISSUER } from '../plugins/auth.js';
import { AppError } from '../plugins/errors.js';

function getRequiredCredential(value: string | null, name: string) {
  if (!value) {
    throw new AppError(503, 'APP_AUTH_NOT_CONFIGURED', `${name} is not configured.`);
  }

  return value;
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/v1/auth/login', async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const expectedUsername = getRequiredCredential(app.appEnv.appAccessUsername, 'APP_ACCESS_USERNAME');
    const expectedPassword = getRequiredCredential(app.appEnv.appAccessPassword, 'APP_ACCESS_PASSWORD');
    const jwtSecret = getRequiredCredential(app.appEnv.appJwtSecret, 'APP_JWT_SECRET');

    if (username !== expectedUsername || password !== expectedPassword) {
      throw new AppError(401, 'APP_AUTH_INVALID_CREDENTIALS', 'Invalid username or password.');
    }

    const expiresInSeconds = 60 * 60 * 12;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = await new SignJWT({
      role: 'authenticated',
      username,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(app.appEnv.appAuthUserId)
      .setIssuer(APP_JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(jwtSecret));

    return {
      token,
      expiresAt,
      user: {
        id: app.appEnv.appAuthUserId,
        username,
        role: 'authenticated',
      },
    };
  });

  app.get('/v1/auth/me', {
    preHandler: app.requireAuth,
  }, async (request) => ({
    user: {
      id: request.auth.userId,
      role: request.auth.role,
    },
  }));
}
