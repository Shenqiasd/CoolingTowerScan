import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type {
  DetectionPersistenceRepo,
  PersistDetectionResult,
} from '../src/modules/detections/detection.schemas.js';

const TEST_ENV = {
  host: '127.0.0.1',
  port: 0,
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  supabaseJwtSecret: 'test-jwt-secret',
};

function createPersistedResult(overrides: Partial<PersistDetectionResult> = {}): PersistDetectionResult {
  return {
    screenshotId: '11111111-1111-4111-8111-111111111111',
    status: 'detected',
    hasCoolingTower: true,
    count: 1,
    confidence: 0.82,
    enterpriseId: '22222222-2222-4222-8222-222222222222',
    candidateId: '33333333-3333-4333-8333-333333333333',
    candidateStatus: 'approved',
    detectionRowCount: 1,
    evidenceCount: 2,
    ...overrides,
  };
}

function createRepo(): DetectionPersistenceRepo {
  return {
    persistDetectionResult: vi.fn(async () => createPersistedResult()),
  };
}

describe('detection persistence routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a detection result without requiring auth', async () => {
    const repo = createRepo();
    const app = buildApp({
      env: TEST_ENV,
      detectionPersistenceRepo: repo,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/detections/persist',
      payload: {
        screenshotId: '11111111-1111-4111-8111-111111111111',
        enterpriseId: '22222222-2222-4222-8222-222222222222',
        result: {
          has_cooling_tower: true,
          count: 1,
          confidence: 0.82,
          detections: [
            {
              x1: 10,
              y1: 20,
              x2: 30,
              y2: 40,
              center_x: 20,
              center_y: 30,
              width: 20,
              height: 20,
              confidence: 0.82,
              class_name: 'cooling_tower',
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ result: createPersistedResult() });
    expect(repo.persistDetectionResult).toHaveBeenCalledWith({
      screenshotId: '11111111-1111-4111-8111-111111111111',
      enterpriseId: '22222222-2222-4222-8222-222222222222',
      result: {
        has_cooling_tower: true,
        count: 1,
        confidence: 0.82,
        detections: [
          {
            x1: 10,
            y1: 20,
            x2: 30,
            y2: 40,
            center_x: 20,
            center_y: 30,
            width: 20,
            height: 20,
            confidence: 0.82,
            class_name: 'cooling_tower',
          },
        ],
      },
    });

    await app.close();
  });

  it('rejects malformed persistence payloads before touching the repo', async () => {
    const repo = createRepo();
    const app = buildApp({
      env: TEST_ENV,
      detectionPersistenceRepo: repo,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/detections/persist',
      payload: {
        screenshotId: '',
        result: null,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('DETECTION_FIELD_INVALID');
    expect(repo.persistDetectionResult).not.toHaveBeenCalled();

    await app.close();
  });
});
