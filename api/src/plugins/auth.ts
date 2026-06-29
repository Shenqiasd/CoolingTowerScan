import { jwtVerify } from 'jose';
import fp from 'fastify-plugin';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';

import { AppError } from './errors.js';

export interface AuthContext {
  userId: string | null;
  role: string;
  isAuthenticated: boolean;
  token: string | null;
}

const UNAUTHENTICATED_AUTH: AuthContext = {
  userId: null,
  role: 'anonymous',
  isAuthenticated: false,
  token: null,
};

export const APP_JWT_ISSUER = 'cooling-tower-scan-api';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

declare module 'fastify' {
  interface FastifyRequest {
    _authContext?: AuthContext;
    auth: AuthContext;
  }

  interface FastifyInstance {
    requireAuth: preHandlerAsyncHookHandler;
  }
}

function getBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
}

async function buildAuthContext(
  authorization: string | undefined,
  app: FastifyInstance,
): Promise<AuthContext> {
  const token = getBearerToken(authorization);
  if (!token) {
    return { ...UNAUTHENTICATED_AUTH };
  }

  if (app.appEnv.appJwtSecret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(app.appEnv.appJwtSecret), {
        issuer: APP_JWT_ISSUER,
      });
      const userId = typeof payload.sub === 'string' ? payload.sub : null;
      if (userId && isUuid(userId)) {
        return {
          userId,
          role: typeof payload.role === 'string' ? payload.role : 'authenticated',
          isAuthenticated: true,
          token,
        };
      }
    } catch {
      // Fall through to Supabase token validation.
    }
  }

  const secret = app.appEnv.supabaseJwtSecret;
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      const userId = typeof payload.sub === 'string' ? payload.sub : null;
      if (!userId) {
        throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid authentication token.');
      }

      return {
        userId,
        role: typeof payload.role === 'string' ? payload.role : 'authenticated',
        isAuthenticated: true,
        token,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid authentication token.');
    }
  }

  try {
    const { data, error } = await app.supabaseAdmin.auth.getUser(token);
    if (error || !data.user?.id) {
      throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid authentication token.');
    }

    return {
      userId: data.user.id,
      role: data.user.role ?? 'authenticated',
      isAuthenticated: true,
      token,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid authentication token.');
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('_authContext');
  app.decorateRequest('auth', {
    getter() {
      return this._authContext ?? UNAUTHENTICATED_AUTH;
    },
    setter(value) {
      this._authContext = value;
    },
  });

  app.addHook('onRequest', async (request) => {
    request.auth = await buildAuthContext(request.headers.authorization, app);
  });

  app.decorate('requireAuth', async (request) => {
    if (!request.auth.isAuthenticated) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
  });
});
