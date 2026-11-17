/**
 * Client-side high performance SWR / Memory Cache
 * Provides instant 0ms data display when switching between pages/tabs.
 * Keeps data synchronized seamlessly with background revalidation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

const memoryStore = new Map<string, CacheEntry<any>>();
const PREFIX = "airnet_cache_";

export function getCachedData<T>(key: string): T | null {
  // 1. Check in-memory store (fastest, 0ms)
  const memEntry = memoryStore.get(key);
  if (memEntry) {
    return memEntry.data as T;
  }

  // 2. Fallback to sessionStorage for persistence across page reloads
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        // Re-populate in-memory store
        memoryStore.set(key, parsed);
        return parsed.data;
      }
    } catch {
      // Ignore storage errors (quota, disabled, etc.)
    }
  }

  return null;
}

export function setCachedData<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  };

  memoryStore.set(key, entry);

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // Storage quota might be exceeded, ignore safely
    }
  }
}

export function invalidateClientCache(pattern?: string): void {
  if (!pattern) {
    memoryStore.clear();
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith(PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
      } catch {
        // Safe ignore
      }
    }
    return;
  }

  // Selective pattern invalidation (e.g. "admin_enquiries" or "admin_*")
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  for (const k of Array.from(memoryStore.keys())) {
    if (regex.test(k)) {
      memoryStore.delete(k);
    }
  }

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(PREFIX)) {
          const subKey = k.slice(PREFIX.length);
          if (regex.test(subKey)) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
      // Safe ignore
    }
  }
}
