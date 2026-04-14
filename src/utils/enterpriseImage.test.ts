import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEnterpriseImageAsset, getAnnotatedUploadTarget } from './enterpriseImage.ts';

test('buildEnterpriseImageAsset derives a lightweight preview for Supabase public object URLs', () => {
  const asset = buildEnterpriseImageAsset(
    'https://demo.supabase.co/storage/v1/object/public/enterprise-images/ent-1/original.png',
  );

  assert.equal(asset?.fullUrl, 'https://demo.supabase.co/storage/v1/object/public/enterprise-images/ent-1/original.png');
  assert.ok(asset?.previewUrl.includes('/render/image/public/enterprise-images/ent-1/original.png'));
  assert.ok(asset?.previewUrl.includes('width=480'));
  assert.ok(asset?.previewUrl.includes('height=480'));
  assert.ok(asset?.previewUrl.includes('resize=cover'));
  assert.ok(!asset?.previewUrl.includes('format='));
});

test('buildEnterpriseImageAsset keeps non-Supabase URLs unchanged', () => {
  const asset = buildEnterpriseImageAsset('https://example.com/raw-image.png');

  assert.deepEqual(asset, {
    fullUrl: 'https://example.com/raw-image.png',
    previewUrl: 'https://example.com/raw-image.png',
  });
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
