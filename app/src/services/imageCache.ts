/**
 * Image Cache Service
 *
 * Caches profile images locally for offline use.
 * Uses expo-file-system to store images in the app's cache directory.
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Cache directory for profile images
const CACHE_DIR = `${FileSystem.cacheDirectory}profile-images/`;

// Cache metadata file
const CACHE_METADATA_FILE = `${FileSystem.documentDirectory}image-cache-metadata.json`;

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
      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      // Load metadata
      const metaInfo = await FileSystem.getInfoAsync(CACHE_METADATA_FILE);
      if (metaInfo.exists) {
        const content = await FileSystem.readAsStringAsync(CACHE_METADATA_FILE);
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
  if (!cacheMetadata) return;
  try {
    await FileSystem.writeAsStringAsync(
      CACHE_METADATA_FILE,
      JSON.stringify(cacheMetadata)
    );
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
    const info = await FileSystem.getInfoAsync(entry.localPath);
    if (!info.exists) {
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
  if (!cacheMetadata) return null;

  const key = getCacheKey(url);

  // Check if already cached and valid
  const existing = await getCachedImageUri(url);
  if (existing) return existing;

  try {
    // Determine file extension
    const ext = url.includes('.png') ? '.png' : '.jpg';
    const localPath = `${CACHE_DIR}${key}${ext}`;

    // Download the image
    const downloadResult = await FileSystem.downloadAsync(url, localPath);

    if (downloadResult.status !== 200) {
      console.log('[ImageCache] Download failed:', downloadResult.status);
      return null;
    }

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    const size = (fileInfo as any).size || 0;

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
      await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
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
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await FileSystem.deleteAsync(CACHE_METADATA_FILE, { idempotent: true });
    cacheMetadata = { entries: {}, totalSize: 0 };
    initPromise = null;
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
