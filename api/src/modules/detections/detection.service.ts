import { AppError } from '../../plugins/errors.js';
import type {
  DetectionBoxInput,
  DetectionPersistenceRepo,
  DetectionResultInput,
  PersistDetectionInput,
} from './detection.schemas.js';

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  throw new AppError(400, 'DETECTION_FIELD_INVALID', `${field} is required.`);
}

function parseNullableString(value: unknown, field: string): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }

  throw new AppError(400, 'DETECTION_FIELD_INVALID', `${field} must be a string or null.`);
}

function parseFiniteNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  throw new AppError(400, 'DETECTION_FIELD_INVALID', `${field} must be a finite number.`);
}

function parseDetectionBox(value: unknown, index: number): DetectionBoxInput {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  if (!item) {
    throw new AppError(400, 'DETECTION_FIELD_INVALID', `detections[${index}] must be an object.`);
  }

  return {
    x1: parseFiniteNumber(item.x1, `detections[${index}].x1`),
    y1: parseFiniteNumber(item.y1, `detections[${index}].y1`),
    x2: parseFiniteNumber(item.x2, `detections[${index}].x2`),
    y2: parseFiniteNumber(item.y2, `detections[${index}].y2`),
    center_x: parseFiniteNumber(item.center_x, `detections[${index}].center_x`),
    center_y: parseFiniteNumber(item.center_y, `detections[${index}].center_y`),
    width: parseFiniteNumber(item.width, `detections[${index}].width`),
    height: parseFiniteNumber(item.height, `detections[${index}].height`),
    confidence: parseFiniteNumber(item.confidence, `detections[${index}].confidence`),
    class_name: typeof item.class_name === 'string' && item.class_name.trim()
      ? item.class_name.trim()
      : 'cooling_tower',
  };
}

function parseDetectionResult(value: unknown): DetectionResultInput {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  if (!item) {
    throw new AppError(400, 'DETECTION_FIELD_INVALID', 'result is required.');
  }

  const rawDetections = Array.isArray(item.detections) ? item.detections : [];
  return {
    has_cooling_tower: Boolean(item.has_cooling_tower),
    count: parseFiniteNumber(item.count, 'result.count'),
    confidence: parseFiniteNumber(item.confidence, 'result.confidence'),
    detections: rawDetections.map(parseDetectionBox),
  };
}

export class DetectionPersistenceService {
  constructor(private readonly repo: DetectionPersistenceRepo) {}

  async persistDetectionResult(body: Record<string, unknown>) {
    const input: PersistDetectionInput = {
      screenshotId: parseRequiredString(body.screenshotId, 'screenshotId'),
      enterpriseId: parseNullableString(body.enterpriseId, 'enterpriseId'),
      result: parseDetectionResult(body.result),
    };

    return this.repo.persistDetectionResult(input);
  }
}
