import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEnterpriseImageAsset,
  buildEnterpriseImagePreviewUrl,
  getAnnotatedUploadTarget,
} from './enterpriseImage.ts';

test('buildEnterpriseImageAsset derives a lightweight preview for Supabase public object URLs', () => {
  const asset = buildEnterpriseImageAsset(
    'https://demo.supabase.co/storage/v1/object/public/enterprise-images/ent-1/original.png',
  );

  assert.equal(asset?.fullUrl, 'https://demo.supabase.co/storage/v1/object/public/enterprise-images/ent-1/original.png');
  assert.ok(asset?.previewUrl.includes('/render/image/public/enterprise-images/ent-1/original.png'));
  assert.ok(asset?.previewUrl.includes('width=320'));
  assert.ok(asset?.previewUrl.includes('height=320'));
  assert.ok(asset?.previewUrl.includes('quality=45'));
  assert.ok(asset?.previewUrl.includes('resize=cover'));
  assert.ok(!asset?.previewUrl.includes('format='));
  assert.ok(asset?.lightboxUrl.includes('width=1600'));
  assert.ok(asset?.lightboxUrl.includes('quality=75'));
  assert.deepEqual(asset.previewCandidates, [
    asset.previewUrl,
    asset.fullUrl,
  ]);
  assert.deepEqual(asset.lightboxCandidates, [
    asset.lightboxUrl,
    asset.fullUrl,
  ]);
});

test('buildEnterpriseImageAsset keeps non-Supabase URLs unchanged', () => {
  const asset = buildEnterpriseImageAsset('https://example.com/raw-image.png');

  assert.deepEqual(asset, {
    fullUrl: 'https://example.com/raw-image.png',
    previewUrl: 'https://example.com/raw-image.png',
    lightboxUrl: 'https://example.com/raw-image.png',
    previewCandidates: ['https://example.com/raw-image.png'],
    lightboxCandidates: ['https://example.com/raw-image.png'],
  });
});

test('buildEnterpriseImagePreviewUrl supports custom preview sizing for transformed views', () => {
  const previewUrl = buildEnterpriseImagePreviewUrl(
    'https://demo.supabase.co/storage/v1/object/public/enterprise-images/ent-1/original.png',
    { width: 1600, height: 1600, quality: 75, resize: 'contain' },
  );

  assert.ok(previewUrl.includes('width=1600'));
  assert.ok(previewUrl.includes('height=1600'));
  assert.ok(previewUrl.includes('quality=75'));
  assert.ok(previewUrl.includes('resize=contain'));
});

test('getAnnotatedUploadTarget uses lighter webp target when available', () => {
  assert.deepEqual(
    getAnnotatedUploadTarget('shot-1', 'scan.png', 'image/webp'),
    {
      path: 'annotated/shot-1.webp',
      extension: 'webp',
      contentType: 'image/webp',
    },
  );
});
