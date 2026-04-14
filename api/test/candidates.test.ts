import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import type {
  CandidateMaterializationResult,
  CandidateDetail,
  CandidateDuplicateItem,
  CandidateListItem,
  CandidateRepo,
  CandidateReviewAction,
} from '../src/modules/candidates/candidate.schemas.js';

const TEST_JWT_SECRET = 'test-jwt-secret';

const TEST_ENV: AppEnv = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: TEST_JWT_SECRET,
};

const LIST_ITEM: CandidateListItem = {
  id: 'candidate-1',
  candidateCode: 'SC-0001',
  status: 'new',
  matchedEnterpriseName: '长鑫存储技术有限公司',
  matchedAddress: '合肥市高新区测试路 1 号',
  coolingTowerCount: 3,
  confidenceScore: 0.92,
  createdAt: '2026-04-13T09:00:00.000Z',
};

const DETAIL_ITEM: CandidateDetail = {
  ...LIST_ITEM,
  siteId: 'site-1',
  enterpriseId: 'enterprise-1',
  scanSessionId: 'session-1',
  reviewNote: '',
  rejectionReason: '',
  hvacEstimateSnapshot: {
    estimatedCapacityRt: 680,
  },
  sourcePayload: {
    source: 'cooling_tower_scan',
  },
  evidences: [
    {
      id: 'evidence-1',
      kind: 'annotated',
      screenshotId: 'shot-1',
      detectionResultId: 'det-1',
      sortOrder: 0,
      metadata: {},
    },
  ],
  updatedAt: '2026-04-13T09:00:00.000Z',
};

const DUPLICATE_ITEM: CandidateDuplicateItem = {
  id: 'candidate-2',
  candidateCode: 'SC-0002',
  status: 'under_review',
  matchedEnterpriseName: '长鑫存储技术有限公司',
  matchedAddress: '合肥市高新区测试路 1 号',
  coolingTowerCount: 2,
  confidenceScore: 0.81,
  createdAt: '2026-04-13T08:30:00.000Z',
  updatedAt: '2026-04-13T09:10:00.000Z',
  siteId: 'site-1',
  enterpriseId: 'enterprise-1',
  duplicateReasons: ['enterprise_id', 'enterprise_name', 'address_similarity'],
};

const TARGET_DETAIL_ITEM: CandidateDetail = {
  ...DETAIL_ITEM,
  id: 'candidate-2',
  candidateCode: 'SC-0002',
  status: 'approved',
  coolingTowerCount: 2,
  confidenceScore: 0.81,
  createdAt: '2026-04-13T08:30:00.000Z',
  updatedAt: '2026-04-13T09:10:00.000Z',
};

async function createToken(userId: string) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));
}

function createRepo(): CandidateRepo {
  return {
    listCandidates: vi.fn(async () => [LIST_ITEM]),
    getCandidateById: vi.fn(async (candidateId: string) => (
      candidateId === DETAIL_ITEM.id
        ? DETAIL_ITEM
        : candidateId === TARGET_DETAIL_ITEM.id
          ? TARGET_DETAIL_ITEM
          : null
    )),
    listDuplicateCandidates: vi.fn(async (candidateId: string) => (
      candidateId === DETAIL_ITEM.id ? [DUPLICATE_ITEM] : []
    )),
    reviewCandidate: vi.fn(async (
      candidateId: string,
      action: CandidateReviewAction,
      note: string,
      actorUserId: string,
    ) => {
      const status: CandidateDetail['status'] = action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : 'needs_info';

      return {
        ...DETAIL_ITEM,
        id: candidateId,
        status,
        reviewNote: note,
        updatedAt: '2026-04-13T10:00:00.000Z',
        lastReviewedBy: actorUserId,
      };
    }),
    dedupeCandidate: vi.fn(async (
      candidateId: string,
      input,
      actorUserId: string,
    ) => ({
      ...DETAIL_ITEM,
      id: candidateId,
      status: 'rejected' as const,
      reviewNote: input.note,
      rejectionReason: `duplicate_of:${input.targetCandidateId}`,
      updatedAt: '2026-04-13T10:15:00.000Z',
      sourcePayload: {
        ...DETAIL_ITEM.sourcePayload,
        duplicateOfCandidateId: input.targetCandidateId,
        dedupeActorUserId: actorUserId,
      },
      lastReviewedBy: actorUserId,
    })),
    materializeFromScanSession: vi.fn(async (
      sessionId: string,
      actorUserId: string,
    ): Promise<CandidateMaterializationResult> => ({
      sessionId,
      actorUserId,
      candidateCount: 1,
      evidenceCount: 3,
    })),
  };
}

describe('candidate routes', () => {
  let app: ReturnType<typeof buildApp> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('rejects unauthenticated access to candidate list', async () => {
    app = buildApp({
      env: TEST_ENV,
      candidateRepo: createRepo(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/candidates',
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

  it('returns candidate list for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      candidateRepo: repo,
    });

    const token = await createToken('user-123');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/candidates',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [LIST_ITEM],
    });
    expect(repo.listCandidates).toHaveBeenCalledWith({
      search: undefined,
      status: undefined,
    });
  });

  it('returns 404 for missing candidate detail', async () => {
    app = buildApp({
      env: TEST_ENV,
      candidateRepo: createRepo(),
    });

    const token = await createToken('user-123');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/candidates/missing-candidate',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'CANDIDATE_NOT_FOUND',
        message: 'Candidate not found.',
        details: {},
      },
    });
  });

  it('reviews a candidate and forwards actor metadata to the repo', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      candidateRepo: repo,
    });

    const token = await createToken('reviewer-1');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/candidates/candidate-1/review',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        action: 'approve',
        note: 'looks good',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      item: {
        ...DETAIL_ITEM,
        reviewNote: 'looks good',
        status: 'approved',
        updatedAt: '2026-04-13T10:00:00.000Z',
        lastReviewedBy: 'reviewer-1',
      },
    });
    expect(repo.reviewCandidate).toHaveBeenCalledWith(
      'candidate-1',
      'approve',
      'looks good',
      'reviewer-1',
    );
  });

  it('returns duplicate candidates for authenticated users', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      candidateRepo: repo,
    });

    const token = await createToken('reviewer-2');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/candidates/candidate-1/duplicates',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [DUPLICATE_ITEM],
    });
    expect(repo.listDuplicateCandidates).toHaveBeenCalledWith('candidate-1');
  });

  it('dedupes a candidate and forwards actor metadata to the repo', async () => {
    const repo = createRepo();
    app = buildApp({
      env: TEST_ENV,
      candidateRepo: repo,
    });

    const token = await createToken('reviewer-3');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/candidates/candidate-1/dedupe',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        targetCandidateId: 'candidate-2',
        note: 'same enterprise and address',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      item: {
        ...DETAIL_ITEM,
        status: 'rejected',
        reviewNote: 'same enterprise and address',
        rejectionReason: 'duplicate_of:candidate-2',
        updatedAt: '2026-04-13T10:15:00.000Z',
        sourcePayload: {
          ...DETAIL_ITEM.sourcePayload,
          duplicateOfCandidateId: 'candidate-2',
          dedupeActorUserId: 'reviewer-3',
        },
        lastReviewedBy: 'reviewer-3',
      },
    });
    expect(repo.dedupeCandidate).toHaveBeenCalledWith(
      'candidate-1',
      {
        targetCandidateId: 'candidate-2',
        note: 'same enterprise and address',
      },
      'reviewer-3',
    );
  });

  it('materializes candidates from a scan session for authenticated users', async () => {
    const repo = createRepo();

    app = buildApp({
      env: TEST_ENV,
      candidateRepo: repo,
    });

    const token = await createToken('operator-7');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/candidates/from-scan-session/session-42',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      result: {
        sessionId: 'session-42',
        actorUserId: 'operator-7',
        candidateCount: 1,
        evidenceCount: 3,
      },
    });
    expect(repo.materializeFromScanSession).toHaveBeenCalledWith('session-42', 'operator-7');
  });
});
