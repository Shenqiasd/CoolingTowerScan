export interface AppEnv {
  host: string;
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseJwtSecret: string | null;
  appAccessUsername: string | null;
  appAccessPassword: string | null;
  appJwtSecret: string | null;
  appAuthUserId: string;
}

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return 3000;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return port;
}

function parseRequiredString(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return trimmed;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    host: env.HOST?.trim() || '0.0.0.0',
    port: parsePort(env.PORT),
    supabaseUrl: parseRequiredString(env.SUPABASE_URL, 'SUPABASE_URL'),
    supabaseServiceRoleKey: parseRequiredString(
      env.SUPABASE_SERVICE_ROLE_KEY,
      'SUPABASE_SERVICE_ROLE_KEY',
    ),
    supabaseJwtSecret: env.SUPABASE_JWT_SECRET?.trim() || null,
    appAccessUsername: env.APP_ACCESS_USERNAME?.trim() || null,
    appAccessPassword: env.APP_ACCESS_PASSWORD?.trim() || null,
    appJwtSecret: env.APP_JWT_SECRET?.trim() || null,
    appAuthUserId: env.APP_AUTH_USER_ID?.trim() || '11111111-1111-4111-8111-111111111111',
  };
}
