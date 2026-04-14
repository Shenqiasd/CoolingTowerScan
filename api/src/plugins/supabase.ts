import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient;
  }
}

export const supabasePlugin = fp(async (app) => {
  const client = createClient(app.appEnv.supabaseUrl, app.appEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  app.decorate('supabaseAdmin', client);
});
