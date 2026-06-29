import type { FastifyInstance } from 'fastify';

import type { DetectionPersistenceRepo } from '../modules/detections/detection.schemas.js';
import { DetectionPersistenceService } from '../modules/detections/detection.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    detectionPersistenceRepo: DetectionPersistenceRepo;
  }
}

export function registerDetectionRoutes(app: FastifyInstance) {
  const service = new DetectionPersistenceService(app.detectionPersistenceRepo);

  app.post('/v1/detections/persist', async (request) => {
    const result = await service.persistDetectionResult((request.body ?? {}) as Record<string, unknown>);
    return { result };
  });
}
