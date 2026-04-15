import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

import { loadEnv, type AppEnv } from './config/env.js';
import { createCandidateRepo } from './modules/candidates/candidate.repo.js';
import type { CandidateRepo } from './modules/candidates/candidate.schemas.js';
import { createLeadRepo } from './modules/leads/lead.repo.js';
import type { LeadRepo } from './modules/leads/lead.schemas.js';
import { createProjectRepo } from './modules/projects/project.repo.js';
import type { ProjectRepo } from './modules/projects/project.schemas.js';
import { auditPlugin } from './plugins/audit.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { supabasePlugin } from './plugins/supabase.js';
import { registerCandidateRoutes } from './routes/candidates.js';
import { registerBootstrapRoute } from './routes/bootstrap.js';
import { registerHealthRoute } from './routes/health.js';
import { registerLeadRoutes } from './routes/leads.js';
import { registerProjectRoutes } from './routes/projects.js';

declare module 'fastify' {
  interface FastifyInstance {
    appEnv: AppEnv;
    candidateRepo: CandidateRepo;
    leadRepo: LeadRepo;
    projectRepo: ProjectRepo;
  }
}

export interface BuildAppOptions {
  env?: AppEnv;
  candidateRepo?: CandidateRepo;
  leadRepo?: LeadRepo;
  projectRepo?: ProjectRepo;
  registerRoutes?: (app: FastifyInstance) => void | Promise<void>;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadEnv();
  const app = Fastify({
    logger: false,
  });

  app.decorate('appEnv', env);
  app.register(errorsPlugin);
  app.register(supabasePlugin);
  app.register(cors, {
    origin: true,
    allowedHeaders: ['Accept', 'Content-Type', 'Authorization'],
  });
  app.register(authPlugin);
  app.register(auditPlugin);
  registerHealthRoute(app);
  registerBootstrapRoute(app);
  app.register(async (instance) => {
    instance.decorate(
      'candidateRepo',
      options.candidateRepo ?? createCandidateRepo(instance.supabaseAdmin),
    );
    registerCandidateRoutes(instance);
  });
  app.register(async (instance) => {
    instance.decorate(
      'leadRepo',
      options.leadRepo ?? createLeadRepo(instance.supabaseAdmin),
    );
    registerLeadRoutes(instance);
  });
  app.register(async (instance) => {
    instance.decorate(
      'projectRepo',
      options.projectRepo ?? createProjectRepo(instance.supabaseAdmin),
    );
    registerProjectRoutes(instance);
  });
  if (options.registerRoutes) {
    app.register(async (instance) => {
      await options.registerRoutes?.(instance);
    });
  }

  return app;
}
