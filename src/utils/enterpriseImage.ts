import { SCREENSHOT_STORAGE_BUCKET } from './storageBuckets.ts';

export interface EnterpriseImageAsset {
  fullUrl: string;
  previewUrl: string;
}

export interface EnterpriseImagePreviewOptions {
  bucket?: string;
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
  format?: 'webp' | 'origin';
}

const DEFAULT_PREVIEW_OPTIONS = {
  bucket: SCREENSHOT_STORAGE_BUCKET,
  width: 480,
  height: 480,
  quality: 60,
  resize: 'cover' as const,
  format: 'webp' as const,
};

export function getSupabaseObjectPathFromPublicUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    const objectPrefix = `/storage/v1/object/public/${bucket}/`;
    const renderPrefix = `/storage/v1/render/image/public/${bucket}/`;

    if (parsed.pathname.startsWith(objectPrefix)) {
      return parsed.pathname.slice(objectPrefix.length);
    }

    if (parsed.pathname.startsWith(renderPrefix)) {
      return parsed.pathname.slice(renderPrefix.length);
    }

    return null;
  } catch {
    return null;
  }
}

export function buildEnterpriseImagePreviewUrl(
  url: string,
  options: EnterpriseImagePreviewOptions,
): string {
  const { bucket, width, height, quality, resize } = {
    ...DEFAULT_PREVIEW_OPTIONS,
    ...options,
  };
  const objectPath = getSupabaseObjectPathFromPublicUrl(url, bucket);

  if (!objectPath) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.pathname = `/storage/v1/render/image/public/${bucket}/${objectPath}`;
    parsed.search = new URLSearchParams({
      width: String(width),
      height: String(height),
      quality: String(quality),
      resize,
      format: options.format ?? DEFAULT_PREVIEW_OPTIONS.format,
    }).toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildEnterpriseImageAsset(
  url: string,
  bucket = SCREENSHOT_STORAGE_BUCKET,
): EnterpriseImageAsset {
  return {
    fullUrl: url,
    previewUrl: buildEnterpriseImagePreviewUrl(url, { bucket }),
  };
}

export function getAnnotatedUploadTarget(
  screenshotId: string | null,
  screenshotFilename: string,
  blobType: string,
): { path: string; extension: 'png' | 'webp'; contentType: 'image/png' | 'image/webp' } {
  const useWebp = blobType === 'image/webp';
  const extension = useWebp ? 'webp' : 'png';
  const contentType = useWebp ? 'image/webp' : 'image/png';
  const objectName = screenshotId ?? screenshotFilename.replace(/\.[^.]+$/, '');

  return {
    extension,
    contentType,
    path: `annotated/${objectName}.${extension}`,
  };
}
