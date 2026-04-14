import type { FastifyInstance } from 'fastify';

import { AppError } from '../plugins/errors.js';
import { LeadService } from '../modules/leads/lead.service.js';
import {
  LEAD_CONFIRM_ACTIONS,
  LEAD_PRIORITIES,
  LEAD_CONFIRMATION_ROLES,
  LEAD_STATUSES,
  type LeadConfirmAction,
  type LeadConfirmationRole,
  type LeadPriority,
  type LeadRepo,
  type LeadStatus,
} from '../modules/leads/lead.schemas.js';

declare module 'fastify' {
  interface FastifyInstance {
    leadRepo: LeadRepo;
  }
}

function parseRequiredString(value: unknown, code: string, message: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new AppError(400, code, message);
}

function parseLeadRole(value: unknown): LeadConfirmationRole {
  if (typeof value === 'string' && LEAD_CONFIRMATION_ROLES.includes(value as LeadConfirmationRole)) {
    return value as LeadConfirmationRole;
  }

  throw new AppError(400, 'LEAD_CONFIRM_ROLE_INVALID', 'Lead confirmation role is invalid.');
}

function parseLeadAction(value: unknown): LeadConfirmAction {
  if (typeof value === 'string' && LEAD_CONFIRM_ACTIONS.includes(value as LeadConfirmAction)) {
    return value as LeadConfirmAction;
  }

  throw new AppError(400, 'LEAD_CONFIRM_ACTION_INVALID', 'Lead confirmation action is invalid.');
}

function parseLeadStatus(value: unknown): LeadStatus | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  if (LEAD_STATUSES.includes(value as LeadStatus)) {
    return value as LeadStatus;
  }

  throw new AppError(400, 'LEAD_STATUS_INVALID', 'Lead status is invalid.');
}

function parseLeadPriority(value: unknown): LeadPriority | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  if (LEAD_PRIORITIES.includes(value as LeadPriority)) {
    return value as LeadPriority;
  }

  throw new AppError(400, 'LEAD_PRIORITY_INVALID', 'Lead priority is invalid.');
}

export function registerLeadRoutes(app: FastifyInstance) {
  const service = new LeadService(app.leadRepo);

  app.register(async (instance) => {
    instance.addHook('preHandler', instance.requireAuth);

    instance.get('/v1/leads', async (request) => {
      const query = (request.query ?? {}) as Record<string, unknown>;
      const items = await service.listLeads({
        status: parseLeadStatus(query.status),
        priority: parseLeadPriority(query.priority),
        search: typeof query.search === 'string' ? query.search : undefined,
      });
      return { items };
    });

    instance.get('/v1/leads/:leadId', async (request) => {
      const params = request.params as { leadId?: string };
      const item = await service.getLeadById(params.leadId ?? '');
      return { item };
    });

    instance.post('/v1/leads', async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.createLead(
        {
          candidateId: parseRequiredString(
            body.candidateId,
            'LEAD_CANDIDATE_ID_REQUIRED',
            'Candidate id is required.',
          ),
          name: parseRequiredString(
            body.name,
            'LEAD_NAME_REQUIRED',
            'Lead name is required.',
          ),
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.post('/v1/leads/:leadId/confirm', async (request) => {
      const params = request.params as { leadId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.confirmLead(
        params.leadId ?? '',
        {
          role: parseLeadRole(body.role),
          action: parseLeadAction(body.action),
          comment: typeof body.comment === 'string' ? body.comment : '',
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.patch('/v1/leads/:leadId', async (request) => {
      const params = request.params as { leadId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.updateLead(
        params.leadId ?? '',
        {
          priority: parseLeadPriority(body.priority),
          salesOwnerUserId: typeof body.salesOwnerUserId === 'string' ? body.salesOwnerUserId : null,
          technicalOwnerUserId: typeof body.technicalOwnerUserId === 'string' ? body.technicalOwnerUserId : null,
          nextAction: typeof body.nextAction === 'string' ? body.nextAction : undefined,
          riskSummary: typeof body.riskSummary === 'string' ? body.riskSummary : undefined,
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.get('/v1/leads/:leadId/audit', async (request) => {
      const params = request.params as { leadId?: string };
      const items = await service.listLeadAuditLogs(params.leadId ?? '');
      return { items };
    });
  });
}
