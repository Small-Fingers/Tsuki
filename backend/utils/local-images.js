import { mkdir, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const imageStorageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../uploads');
await mkdir(imageStorageDir, { recursive: true });

const imageFilenamePattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.(?:jpg|png|webp|avif)$/i;

export function isStoredImageFilename(filename) {
  return typeof filename === 'string' && imageFilenamePattern.test(filename);
}

export function propertyImageFilenames(property) {
  const direct = property.imageFiles || [];
  const fromUrls = (property.images || []).flatMap((value) => {
    if (typeof value !== 'string') return [];
    try {
      const { pathname } = new URL(value, 'http://local.invalid');
      if (!pathname.startsWith('/uploads/')) return [];
      return [decodeURIComponent(pathname.slice('/uploads/'.length))];
    } catch {
      return [];
    }
  });
  return [...new Set([...direct, ...fromUrls].filter(isStoredImageFilename))];
}

export async function deleteImageFiles(filenames = []) {
  const safeNames = [...new Set(filenames)].filter(isStoredImageFilename);
  const results = await Promise.allSettled(safeNames.map((filename) => unlink(resolve(imageStorageDir, filename))));
  const failure = results.find((result) => result.status === 'rejected' && result.reason?.code !== 'ENOENT');
  if (failure) throw failure.reason;
}
