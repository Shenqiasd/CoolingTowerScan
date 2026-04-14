import type { FastifyInstance } from 'fastify';

import { CANDIDATE_STATUSES } from '../modules/candidates/candidate.schemas.js';
import { LEAD_CONFIRMATION_ROLES, LEAD_CONFIRMATION_STATUSES, LEAD_STATUSES } from '../modules/leads/lead.schemas.js';
import {
  PROJECT_STAGE_CODES,
  PROJECT_STAGE_STATUSES,
  PROJECT_WORKFLOW_STATUSES,
} from '../modules/projects/project.schemas.js';

export function registerBootstrapRoute(app: FastifyInstance) {
  app.get('/v1/bootstrap', async (request) => ({
    auth: {
      userId: request.auth.userId,
      role: request.auth.role,
      isAuthenticated: request.auth.isAuthenticated,
    },
    services: {
      api: 'self',
      supabaseUrl: app.appEnv.supabaseUrl,
    },
    dictionaries: {
      candidateStatuses: CANDIDATE_STATUSES,
      leadStatuses: LEAD_STATUSES,
      leadConfirmationRoles: LEAD_CONFIRMATION_ROLES,
      leadConfirmationStatuses: LEAD_CONFIRMATION_STATUSES,
      projectStageCodes: PROJECT_STAGE_CODES,
      projectStageStatuses: PROJECT_STAGE_STATUSES,
      projectWorkflowStatuses: PROJECT_WORKFLOW_STATUSES,
    },
  }));
}
