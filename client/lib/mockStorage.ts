/**
 * Browser-storage abstraction for the mock API layer.
 *
 * All mock services read/write through these helpers so storage
 * concerns stay in one place. Swap localStorage for IndexedDB or
 * a real HTTP client here when migrating to a live backend.
 */

const PREFIX = "ll_";

function prefixed(key: string): string {
  return `${PREFIX}${key}`;
}

export function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefixed(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(prefixed(key), JSON.stringify(value));
  } catch {
    // storage full or private browsing — degrade silently
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(prefixed(key));
  } catch {
    // ignore
  }
}

/**
 * Write `defaultValue` only when the key is missing or contains
 * un-parseable JSON. Returns the current (possibly seeded) value.
 */
export function seedIfMissing<T>(key: string, defaultValue: T): T {
  const existing = getItem<T | null>(key, null);
  if (existing !== null && (Array.isArray(defaultValue) ? Array.isArray(existing) : typeof existing === typeof defaultValue)) {
    return existing;
  }
  setItem(key, defaultValue);
  return defaultValue;
}

/** Blow away one module's storage key and re-seed. */
export function resetModuleData<T>(key: string, seed: T): T {
  setItem(key, seed);
  return seed;
}

/** Remove every `ll_*` key — useful for full-reset during development. */
export function resetAllData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/** Storage key constants — keep module keys co-located. */
export const STORAGE_KEYS = {
  users: "users",
  passwords: "passwords",
  sessions: "sessions",
  courses: "courses",
  lessons: "lessons",
  enrollments: "enrollments",
  completions: "completions",
  roles: "roles",
  audit: "audit",
  lessonVersions: "lesson_versions",
} as const;
