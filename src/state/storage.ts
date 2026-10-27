/**
 * Defensive localStorage wrapper. Storage problems (private mode, quota,
 * corrupted JSON) never stop the game: reads fall back to defaults and
 * failed writes are reported, not thrown.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

export const PREFIX = 'mindvault.v1.';

function detect(): { store: KeyValueStore; persistent: boolean } {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls) {
      const probe = `${PREFIX}__probe`;
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return { store: ls, persistent: true };
    }
  } catch {
    /* fall through */
  }
  return { store: new MemoryStore(), persistent: false };
}

let backend = detect();
let lastError: string | null = null;
const pruneHooks: (() => void)[] = [];

/** Test hook / embedding: replace the backing store. */
export function setStorageBackend(store: KeyValueStore, persistent = true) {
  backend = { store, persistent };
}

export function storageIsPersistent(): boolean {
  return backend.persistent;
}

export function lastStorageError(): string | null {
  return lastError;
}

/** Called when a write hits the quota so callers can trim their data first. */
export function onQuotaPressure(fn: () => void) {
  pruneHooks.push(fn);
}

export function load<T>(key: string, fallback: T, sanitize?: (raw: unknown) => T | null): T {
  try {
    const raw = backend.store.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (sanitize) {
      const clean = sanitize(parsed);
      return clean ?? fallback;
    }
    return parsed as T;
  } catch (e) {
    lastError = `Could not read saved ${key}: ${(e as Error).message}`;
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (e) {
    lastError = `Could not serialise ${key}: ${(e as Error).message}`;
    return false;
  }
  try {
    backend.store.setItem(PREFIX + key, text);
    return true;
  } catch {
    // Most likely the quota: let stores prune, then retry once.
    for (const fn of pruneHooks) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    try {
      backend.store.setItem(PREFIX + key, text);
      return true;
    } catch (e) {
      lastError = `Saving ${key} failed (${(e as Error).message}). Progress for this session is kept in memory only.`;
      return false;
    }
  }
}

export function remove(key: string) {
  try {
    backend.store.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Removes every MINDVAULT key (used by "reset all data"). */
export function clearAll() {
  try {
    const keys: string[] = [];
    const n = backend.store.length ?? 0;
    for (let i = 0; i < n; i++) {
      const k = backend.store.key?.(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) backend.store.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Approximate bytes used by MINDVAULT keys. */
export function usageBytes(): number {
  let total = 0;
  try {
    const n = backend.store.length ?? 0;
    for (let i = 0; i < n; i++) {
      const k = backend.store.key?.(i);
      if (k && k.startsWith(PREFIX)) total += k.length + (backend.store.getItem(k)?.length ?? 0);
    }
  } catch {
    /* ignore */
  }
  return total * 2;
}

export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
