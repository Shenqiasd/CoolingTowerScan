import type { FastifyInstance } from 'fastify';

import { AppError } from '../plugins/errors.js';
import { CandidateService } from '../modules/candidates/candidate.service.js';
import {
  CANDIDATE_REVIEW_ACTIONS,
  CANDIDATE_STATUSES,
  type CandidateRepo,
  type CandidateReviewAction,
  type CandidateStatus,
} from '../modules/candidates/candidate.schemas.js';

declare module 'fastify' {
  interface FastifyInstance {
    candidateRepo: CandidateRepo;
  }
}

function parseStatus(value: unknown): CandidateStatus | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  if (CANDIDATE_STATUSES.includes(value as CandidateStatus)) {
    return value as CandidateStatus;
  }

  throw new AppError(400, 'CANDIDATE_STATUS_INVALID', 'Candidate status is invalid.');
}

function parseReviewAction(value: unknown): CandidateReviewAction {
  if (typeof value === 'string' && CANDIDATE_REVIEW_ACTIONS.includes(value as CandidateReviewAction)) {
    return value as CandidateReviewAction;
  }

  throw new AppError(400, 'CANDIDATE_REVIEW_ACTION_INVALID', 'Candidate review action is invalid.');
}

function parseNote(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return '';
  }

  throw new AppError(400, 'CANDIDATE_REVIEW_NOTE_INVALID', 'Candidate review note must be a string.');
}

export function registerCandidateRoutes(app: FastifyInstance) {
  const service = new CandidateService(app.candidateRepo);

  app.register(async (instance) => {
    instance.addHook('preHandler', instance.requireAuth);

    instance.get('/v1/candidates', async (request) => {
      const items = await service.listCandidates({
        status: parseStatus(request.query && (request.query as Record<string, unknown>).status),
        search: typeof (request.query as Record<string, unknown> | undefined)?.search === 'string'
          ? ((request.query as Record<string, unknown>).search as string)
          : undefined,
      });

      return { items };
    });

    instance.get('/v1/candidates/:candidateId', async (request) => {
      const params = request.params as { candidateId?: string };
      const item = await service.getCandidateById(params.candidateId ?? '');
      return { item };
    });

    instance.get('/v1/candidates/:candidateId/duplicates', async (request) => {
      const params = request.params as { candidateId?: string };
      const items = await service.listDuplicateCandidates(params.candidateId ?? '');
      return { items };
    });

    instance.post('/v1/candidates/:candidateId/review', async (request) => {
      const params = request.params as { candidateId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.reviewCandidate(
        params.candidateId ?? '',
        {
          action: parseReviewAction(body.action),
          note: parseNote(body.note),
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.post('/v1/candidates/:candidateId/dedupe', async (request) => {
      const params = request.params as { candidateId?: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const item = await service.dedupeCandidate(
        params.candidateId ?? '',
        {
          targetCandidateId: parseNote(body.targetCandidateId).trim(),
          note: parseNote(body.note),
        },
        request.auth.userId ?? '',
      );

      return { item };
    });

    instance.post('/v1/candidates/from-scan-session/:sessionId', async (request) => {
      const params = request.params as { sessionId?: string };
      const result = await service.materializeFromScanSession({
        sessionId: params.sessionId ?? '',
        actorUserId: request.auth.userId ?? '',
      });

      return { result };
    });
  });
}
