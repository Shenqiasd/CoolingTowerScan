import { jwtVerify } from 'jose';
import fp from 'fastify-plugin';
import type { preHandlerAsyncHookHandler } from 'fastify';

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

async function buildAuthContext(authorization: string | undefined, secret: string): Promise<AuthContext> {
  const token = getBearerToken(authorization);
  if (!token) {
    return { ...UNAUTHENTICATED_AUTH };
  }

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
    request.auth = await buildAuthContext(request.headers.authorization, app.appEnv.supabaseJwtSecret);
  });

  app.decorate('requireAuth', async (request) => {
    if (!request.auth.isAuthenticated) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
  });
});
