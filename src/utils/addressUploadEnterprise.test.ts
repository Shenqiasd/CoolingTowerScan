import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScanDetection } from '../types/pipeline.ts';
import {
  buildEnterpriseDraftFromDetection,
  ensureEnterpriseForAddressUpload,
  shouldAutoCreateEnterpriseForUpload,
} from './addressUploadEnterprise.ts';

function makeDetection(overrides: Partial<ScanDetection> = {}): ScanDetection {
  return {
    screenshotFilename: 'stitched_Z18_test.png',
    screenshotId: 'shot-1',
    enterpriseId: null,
    lng: 121.5,
    lat: 31.2,
    source: 'address',
    addressLabel: '日月光',
    resolvedAddress: '上海市浦东新区测试路 88 号',
    hasCoolingTower: true,
    count: 2,
    confidence: 0.86,
    imageUrl: 'https://example.com/source.png',
    publicUrl: 'https://example.com/source.png',
    detections: [
      { class_name: 'cooling_tower', confidence: 0.86, x1: 10, y1: 10, x2: 20, y2: 20 },
    ],
    ...overrides,
  };
}

test('buildEnterpriseDraftFromDetection creates the minimal enterprise payload for address uploads', () => {
  const draft = buildEnterpriseDraftFromDetection(makeDetection(), 'https://example.com/annotated.png', '2026-04-10T09:30:00.000Z');

  assert.equal(draft.enterprise_name, '日月光');
  assert.equal(draft.address, '上海市浦东新区测试路 88 号');
  assert.equal(draft.longitude, 121.5);
  assert.equal(draft.latitude, 31.2);
  assert.equal(draft.has_cooling_tower, true);
  assert.equal(draft.cooling_tower_count, 2);
  assert.equal(draft.annotated_image_url, 'https://example.com/annotated.png');
  assert.equal(draft.image_uploaded_at, '2026-04-10T09:30:00.000Z');
});

test('shouldAutoCreateEnterpriseForUpload only allows address detections with towers and no bound enterprise', () => {
  assert.equal(shouldAutoCreateEnterpriseForUpload(makeDetection()), true);
  assert.equal(shouldAutoCreateEnterpriseForUpload(makeDetection({ enterpriseId: 'ent-1' })), false);
  assert.equal(shouldAutoCreateEnterpriseForUpload(makeDetection({ hasCoolingTower: false })), false);
  assert.equal(shouldAutoCreateEnterpriseForUpload(makeDetection({ source: 'area' })), false);
});

test('ensureEnterpriseForAddressUpload reuses an exact address match before creating a new enterprise', async () => {
  const calls: string[] = [];

  const result = await ensureEnterpriseForAddressUpload({
    detection: makeDetection(),
    annotatedUrl: 'https://example.com/annotated.png',
    now: () => '2026-04-10T09:30:00.000Z',
    repo: {
      async findByAddress(address) {
        calls.push(`address:${address}`);
        return { id: 'ent-existing', enterprise_name: '日月光', address };
      },
      async findByName() {
        calls.push('name');
        return null;
      },
      async createEnterprise() {
        calls.push('create');
        throw new Error('should not create when address matches');
      },
      async linkScreenshotToEnterprise() {
        calls.push('link');
      },
      async updateEnterpriseAnnotatedImage() {
        calls.push('update-image');
      },
    },
  });

  assert.ok(result);
  assert.equal(result.enterpriseId, 'ent-existing');
  assert.equal(result.created, false);
  assert.deepEqual(calls, [
    'address:上海市浦东新区测试路 88 号',
    'link',
    'update-image',
  ]);
});

test('ensureEnterpriseForAddressUpload creates a minimal enterprise when no reusable record exists', async () => {
  const createdRows: Array<ReturnType<typeof buildEnterpriseDraftFromDetection>> = [];

  const result = await ensureEnterpriseForAddressUpload({
    detection: makeDetection(),
    annotatedUrl: 'https://example.com/annotated.png',
    now: () => '2026-04-10T09:30:00.000Z',
    repo: {
      async findByAddress() {
        return null;
      },
      async findByName() {
        return null;
      },
      async createEnterprise(input) {
        createdRows.push(input);
        return { id: 'ent-created', enterprise_name: input.enterprise_name as string, address: input.address as string };
      },
      async linkScreenshotToEnterprise() {},
      async updateEnterpriseAnnotatedImage() {},
    },
  });

  assert.ok(result);
  assert.equal(result.enterpriseId, 'ent-created');
  assert.equal(result.created, true);
  assert.equal(createdRows.length, 1);
  assert.equal(createdRows[0].address, '上海市浦东新区测试路 88 号');
  assert.equal(createdRows[0].longitude, 121.5);
});
