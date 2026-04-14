import { AppError } from '../../plugins/errors.js';
import type {
  CandidateDedupeInput,
  CandidateMaterializationInput,
  CandidateListFilters,
  CandidateRepo,
  CandidateReviewInput,
} from './candidate.schemas.js';

export class CandidateService {
  constructor(private readonly repo: CandidateRepo) {}

  listCandidates(filters: CandidateListFilters) {
    return this.repo.listCandidates(filters);
  }

  async getCandidateById(candidateId: string) {
    const item = await this.repo.getCandidateById(candidateId);
    if (!item) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return item;
  }

  async listDuplicateCandidates(candidateId: string) {
    const id = candidateId.trim();
    if (!id) {
      throw new AppError(400, 'CANDIDATE_ID_REQUIRED', 'Candidate id is required.');
    }

    const item = await this.repo.getCandidateById(id);
    if (!item) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return this.repo.listDuplicateCandidates(id);
  }

  async reviewCandidate(candidateId: string, input: CandidateReviewInput, actorUserId: string) {
    const note = input.note.trim();
    const item = await this.repo.reviewCandidate(candidateId, input.action, note, actorUserId);
    if (!item) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return item;
  }

  async dedupeCandidate(candidateId: string, input: CandidateDedupeInput, actorUserId: string) {
    const id = candidateId.trim();
    const targetCandidateId = input.targetCandidateId.trim();
    const note = input.note.trim();

    if (!id) {
      throw new AppError(400, 'CANDIDATE_ID_REQUIRED', 'Candidate id is required.');
    }

    if (!targetCandidateId) {
      throw new AppError(400, 'CANDIDATE_DEDUPE_TARGET_REQUIRED', 'Target candidate id is required.');
    }

    if (id === targetCandidateId) {
      throw new AppError(400, 'CANDIDATE_DEDUPE_SELF_INVALID', 'Candidate cannot be deduped into itself.');
    }

    const [source, target] = await Promise.all([
      this.repo.getCandidateById(id),
      this.repo.getCandidateById(targetCandidateId),
    ]);

    if (!source) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    if (!target) {
      throw new AppError(404, 'CANDIDATE_DEDUPE_TARGET_NOT_FOUND', 'Target candidate not found.');
    }

    const item = await this.repo.dedupeCandidate(id, {
      targetCandidateId,
      note,
    }, actorUserId);

    if (!item) {
      throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }

    return item;
  }

  async materializeFromScanSession(input: CandidateMaterializationInput) {
    if (!input.sessionId.trim()) {
      throw new AppError(400, 'CANDIDATE_SESSION_ID_REQUIRED', 'Session ID is required.');
    }

    return this.repo.materializeFromScanSession(input.sessionId, input.actorUserId);
  }
}
