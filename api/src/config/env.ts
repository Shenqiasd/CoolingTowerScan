export interface AppEnv {
  host: string;
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseJwtSecret: string | null;
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
  };
}
