/**
 * Image Cache Service
 *
 * Caches profile images locally for offline use.
 * Uses expo-file-system's new File/Directory API.
 */

import { File, Directory, Paths } from 'expo-file-system/next';

// Cache directory for profile images
const CACHE_DIR_NAME = 'profile-images';
const METADATA_FILE_NAME = 'image-cache-metadata.json';

// Maximum cache age in milliseconds (7 days)
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Maximum cache size in bytes (50 MB)
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

interface CacheEntry {
  url: string;
  localPath: string;
  cachedAt: number;
  size: number;
}

interface CacheMetadata {
  entries: Record<string, CacheEntry>;
  totalSize: number;
}

let cacheMetadata: CacheMetadata | null = null;
let initPromise: Promise<void> | null = null;
let cacheDir: Directory | null = null;
let metadataFile: File | null = null;

/**
 * Generate a cache key from a URL.
 * Extracts the unique part (user ID and filename) for consistent caching.
 */
function getCacheKey(url: string): string {
  try {
    // Remove query params for cache key (they're for cache busting)
    const urlWithoutQuery = url.split('?')[0];
    // Extract path after the domain
    const match = urlWithoutQuery.match(/\/users\/([^/]+)\/([^/]+)$/);
    if (match) {
      return `${match[1]}_${match[2]}`;
    }
    // Fallback: hash the URL
    let hash = 0;
    for (let i = 0; i < urlWithoutQuery.length; i++) {
      const char = urlWithoutQuery.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `img_${Math.abs(hash)}`;
  } catch {
    return `img_${Date.now()}`;
  }
}

/**
 * Initialize the cache directory and load metadata.
 */
async function initCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Set up cache directory
      cacheDir = new Directory(Paths.cache, CACHE_DIR_NAME);
      if (!cacheDir.exists) {
        cacheDir.create();
      }

      // Set up metadata file
      metadataFile = new File(Paths.document, METADATA_FILE_NAME);
      if (metadataFile.exists) {
        const content = metadataFile.text();
        cacheMetadata = JSON.parse(content);
      } else {
        cacheMetadata = { entries: {}, totalSize: 0 };
      }
    } catch (error) {
      console.log('[ImageCache] Init error, starting fresh:', error);
      cacheMetadata = { entries: {}, totalSize: 0 };
    }
  })();

  return initPromise;
}

/**
 * Save cache metadata to disk.
 */
async function saveMetadata(): Promise<void> {
  if (!cacheMetadata || !metadataFile) return;
  try {
    metadataFile.write(JSON.stringify(cacheMetadata));
  } catch (error) {
    console.log('[ImageCache] Failed to save metadata:', error);
  }
}

/**
 * Get the local URI for a cached image, if available.
 * Returns null if not cached or cache is stale.
 */
export async function getCachedImageUri(url: string): Promise<string | null> {
  if (!url) return null;

  await initCache();
  if (!cacheMetadata) return null;

  const key = getCacheKey(url);
  const entry = cacheMetadata.entries[key];

  if (!entry) {
    return null;
  }

  // Check if cache is stale
  if (Date.now() - entry.cachedAt > MAX_CACHE_AGE_MS) {
    // Don't delete yet, just return null to trigger re-download
    return null;
  }

  // Verify file still exists
  try {
    const file = new File(entry.localPath);
    if (!file.exists) {
      delete cacheMetadata.entries[key];
      cacheMetadata.totalSize -= entry.size;
      await saveMetadata();
      return null;
    }
    return entry.localPath;
  } catch {
    return null;
  }
}

/**
 * Cache an image from a URL.
 * Downloads the image and stores it locally.
 */
export async function cacheImage(url: string): Promise<string | null> {
  if (!url) return null;

  await initCache();
  if (!cacheMetadata || !cacheDir) return null;

  const key = getCacheKey(url);

  // Check if already cached and valid
  const existing = await getCachedImageUri(url);
  if (existing) return existing;

  try {
    // Determine file extension
    const ext = url.includes('.png') ? '.png' : '.jpg';
    const fileName = `${key}${ext}`;
    const localFile = new File(cacheDir, fileName);

    // Download the image
    const response = await fetch(url);
    if (!response.ok) {
      console.log('[ImageCache] Download failed:', response.status);
      return null;
    }

    const blob = await response.blob();

    // Convert blob to base64 using FileReader (React Native compatible)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        } else {
          reject(new Error('Failed to read blob as base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Write base64 to file
    localFile.write(base64, { encoding: 'base64' });

    const size = blob.size;
    const localPath = localFile.uri;

    // Update metadata
    cacheMetadata.entries[key] = {
      url,
      localPath,
      cachedAt: Date.now(),
      size,
    };
    cacheMetadata.totalSize += size;

    // Cleanup if over size limit
    if (cacheMetadata.totalSize > MAX_CACHE_SIZE_BYTES) {
      await cleanupOldEntries();
    }

    await saveMetadata();

    console.log(`[ImageCache] Cached: ${key} (${Math.round(size / 1024)}KB)`);
    return localPath;
  } catch (error) {
    console.log('[ImageCache] Cache error:', error);
    return null;
  }
}

/**
 * Remove old cache entries to stay under size limit.
 */
async function cleanupOldEntries(): Promise<void> {
  if (!cacheMetadata) return;

  // Sort entries by age (oldest first)
  const entries = Object.entries(cacheMetadata.entries)
    .sort(([, a], [, b]) => a.cachedAt - b.cachedAt);

  // Remove oldest entries until under limit
  for (const [key, entry] of entries) {
    if (cacheMetadata.totalSize <= MAX_CACHE_SIZE_BYTES * 0.8) break;

    try {
      const file = new File(entry.localPath);
      if (file.exists) {
        file.delete();
      }
      cacheMetadata.totalSize -= entry.size;
      delete cacheMetadata.entries[key];
      console.log(`[ImageCache] Cleaned up: ${key}`);
    } catch {
      // Ignore deletion errors
    }
  }
}

/**
 * Clear all cached images.
 */
export async function clearImageCache(): Promise<void> {
  try {
    if (cacheDir?.exists) {
      cacheDir.delete();
    }
    if (metadataFile?.exists) {
      metadataFile.delete();
    }
    cacheMetadata = { entries: {}, totalSize: 0 };
    initPromise = null;
    cacheDir = null;
    metadataFile = null;
    console.log('[ImageCache] Cache cleared');
  } catch (error) {
    console.log('[ImageCache] Clear error:', error);
  }
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<{ count: number; totalSizeMB: number }> {
  await initCache();
  if (!cacheMetadata) return { count: 0, totalSizeMB: 0 };

  return {
    count: Object.keys(cacheMetadata.entries).length,
    totalSizeMB: Math.round(cacheMetadata.totalSize / 1024 / 1024 * 100) / 100,
  };
}

/**
 * Pre-cache an image in the background.
 * Use this to cache images proactively.
 */
export function preCacheImage(url: string): void {
  if (!url) return;
  // Fire and forget
  cacheImage(url).catch(() => {});
}
