import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import type {
  LeadAuditLogItem,
  LeadConfirmationRole,
  LeadConfirmAction,
  LeadConfirmationStatus,
  LeadDetail,
  LeadListItem,
  LeadRepo,
} from '../src/modules/leads/lead.schemas.js';

const TEST_JWT_SECRET = 'test-jwt-secret';

const TEST_ENV: AppEnv = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: TEST_JWT_SECRET,
};

const BASE_LEAD: LeadDetail = {
  id: 'lead-1',
  leadCode: 'LEAD-0001',
  candidateId: 'candidate-1',
  enterpriseId: 'enterprise-1',
  siteId: 'site-1',
  name: '长鑫存储技术有限公司',
  status: 'pending_confirmation',
  priority: 'medium',
  salesOwnerUserId: 'sales-user-1',
  technicalOwnerUserId: null,
  nextAction: '',
  riskSummary: '',
  qualificationSummary: {},
  sourceSnapshot: {},
  createdAt: '2026-04-13T12:00:00.000Z',
  updatedAt: '2026-04-13T12:00:00.000Z',
  confirmations: [
    {
      role: 'sales',
      status: 'pending',
      comment: '',
      confirmedBy: null,
      confirmedAt: null,
    },
    {
      role: 'technical',
      status: 'pending',
      comment: '',
      confirmedBy: null,
      confirmedAt: null,
    },
  ],
};

const BASE_LEAD_LIST_ITEM: LeadListItem = {
  id: BASE_LEAD.id,
  leadCode: BASE_LEAD.leadCode,
  candidateId: BASE_LEAD.candidateId,
  enterpriseId: BASE_LEAD.enterpriseId,
  siteId: BASE_LEAD.siteId,
  name: BASE_LEAD.name,
  status: BASE_LEAD.status,
  priority: BASE_LEAD.priority,
  salesOwnerUserId: 'sales-user-1',
  technicalOwnerUserId: null,
  nextAction: BASE_LEAD.nextAction,
  riskSummary: BASE_LEAD.riskSummary,
  createdAt: BASE_LEAD.createdAt,
  updatedAt: BASE_LEAD.updatedAt,
  confirmations: BASE_LEAD.confirmations.map((item) => ({
    role: item.role,
    status: item.status,
  })),
};

const BASE_AUDIT_ITEM: LeadAuditLogItem = {
  id: 'audit-1',
  entityType: 'lead',
  entityId: 'lead-1',
  action: 'lead.created',
  actorUserId: 'sales-user-1',
  actorSource: 'api',
  payload: {
    candidateId: 'candidate-1',
  },
  createdAt: '2026-04-13T12:00:00.000Z',
};

async function createToken(userId: string) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));
}

function createRepo(candidateStatus: 'approved' | 'new' = 'approved'): LeadRepo {
  return {
    getCandidateStatus: vi.fn(async () => candidateStatus),
    listLeads: vi.fn(async () => [BASE_LEAD_LIST_ITEM]),
    getLeadById: vi.fn(async (leadId: string) => ({
      ...BASE_LEAD,
      id: leadId,
      salesOwnerUserId: 'sales-user-1',
      technicalOwnerUserId: null,
    })),
    updateLead: vi.fn(async (leadId: string, input) => ({
      ...BASE_LEAD,
      id: leadId,
      priority: input.priority ?? BASE_LEAD.priority,
      nextAction: input.nextAction ?? BASE_LEAD.nextAction,
      riskSummary: input.riskSummary ?? BASE_LEAD.riskSummary,
      salesOwnerUserId: input.salesOwnerUserId ?? 'sales-user-1',
      technicalOwnerUserId: input.technicalOwnerUserId ?? null,
    })),
    listLeadAuditLogs: vi.fn(async () => [BASE_AUDIT_ITEM]),
    createLeadFromCandidate: vi.fn(async (
      candidateId: string,
      name: string,
      actorUserId: string,
    ) => ({
      ...BASE_LEAD,
      candidateId,
      name,
      salesOwnerUserId: actorUserId,
      technicalOwnerUserId: null,
      createdBy: actorUserId,
    })),
    confirmLead: vi.fn(async (
      leadId: string,
      role: LeadConfirmationRole,
      action: LeadConfirmAction,
      comment: string,
      actorUserId: string,
    ) => {
      const nextStatus: LeadConfirmationStatus = action === 'confirm' ? 'confirmed' : 'rejected';

      return {
        ...BASE_LEAD,
        id: leadId,
        salesOwnerUserId: 'sales-user-1',
        technicalOwnerUserId: null,
        updatedAt: '2026-04-13T13:00:00.000Z',
        confirmations: BASE_LEAD.confirmations.map((item) => (
          item.role === role
            ? {
                ...item,
                status: nextStatus,
                comment,
                confirmedBy: actorUserId,
                confirmedAt: '2026-04-13T13:00:00.000Z',
              }
            : item
        )),
      };
    }),
  };
}

describe('lead routes', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('rejects unauthenticated lead creation', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      payload: {
        candidateId: 'candidate-1',
        name: '长鑫存储技术有限公司',
      },
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

  it('creates a lead only from an approved candidate', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        candidateId: 'candidate-1',
        name: '长鑫存储技术有限公司',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      item: {
        ...BASE_LEAD,
        createdBy: 'sales-user-1',
      },
    });
    expect(repo.getCandidateStatus).toHaveBeenCalledWith('candidate-1');
    expect(repo.createLeadFromCandidate).toHaveBeenCalledWith(
      'candidate-1',
      '长鑫存储技术有限公司',
      'sales-user-1',
    );
  });

  it('returns lead list for authenticated users', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/leads',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [BASE_LEAD_LIST_ITEM],
    });
    expect(repo.listLeads).toHaveBeenCalledWith({
      priority: undefined,
      search: undefined,
      status: undefined,
    });
  });

  it('supports lead list filters', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/leads?status=pending_confirmation&priority=medium&search=长鑫',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repo.listLeads).toHaveBeenCalledWith({
      status: 'pending_confirmation',
      priority: 'medium',
      search: '长鑫',
    });
  });

  it('returns lead detail for authenticated users', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/leads/lead-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      item: BASE_LEAD,
    });
    expect(repo.getLeadById).toHaveBeenCalledWith('lead-1');
  });

  it('blocks lead creation when the candidate is not approved', async () => {
    const repo = createRepo('new');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/leads',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        candidateId: 'candidate-1',
        name: '长鑫存储技术有限公司',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'CANDIDATE_NOT_APPROVED',
        message: 'Candidate must be approved before creating a lead.',
        details: {},
      },
    });
  });

  it('confirms a lead and forwards actor metadata', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('tech-user-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/leads/lead-1/confirm',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        role: 'technical',
        action: 'confirm',
        comment: 'site review complete',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      item: {
        ...BASE_LEAD,
        updatedAt: '2026-04-13T13:00:00.000Z',
        confirmations: [
          BASE_LEAD.confirmations[0],
          {
            role: 'technical',
            status: 'confirmed',
            comment: 'site review complete',
            confirmedBy: 'tech-user-1',
            confirmedAt: '2026-04-13T13:00:00.000Z',
          },
        ],
      },
    });
    expect(repo.confirmLead).toHaveBeenCalledWith(
      'lead-1',
      'technical',
      'confirm',
      'site review complete',
      'tech-user-1',
    );
  });

  it('updates lead editable fields', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/leads/lead-1',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        priority: 'high',
        nextAction: '安排电话沟通',
        riskSummary: '地址仍需复核',
        salesOwnerUserId: 'sales-owner-1',
        technicalOwnerUserId: 'tech-owner-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repo.updateLead).toHaveBeenCalledWith(
      'lead-1',
      {
        priority: 'high',
        salesOwnerUserId: 'sales-owner-1',
        technicalOwnerUserId: 'tech-owner-1',
        nextAction: '安排电话沟通',
        riskSummary: '地址仍需复核',
      },
      'sales-user-1',
    );
    expect(response.json()).toEqual({
      item: {
        ...BASE_LEAD,
        priority: 'high',
        nextAction: '安排电话沟通',
        riskSummary: '地址仍需复核',
        salesOwnerUserId: 'sales-owner-1',
        technicalOwnerUserId: 'tech-owner-1',
      },
    });
  });

  it('returns lead audit logs', async () => {
    const repo = createRepo('approved');
    app = buildApp({
      env: TEST_ENV,
      leadRepo: repo,
    });

    const token = await createToken('sales-user-1');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/leads/lead-1/audit',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repo.listLeadAuditLogs).toHaveBeenCalledWith('lead-1');
    expect(response.json()).toEqual({
      items: [BASE_AUDIT_ITEM],
    });
  });
});
