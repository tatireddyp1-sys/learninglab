/**
 * Global access/refresh token persistence (localStorage).
 * React state stays in sync via `subscribeSessionTokens` (used by AuthProvider).
 */

const ACCESS_KEY = "learninglab_access_token";
const REFRESH_KEY = "learninglab_refresh_token";
const CHANGED = "learninglab-session-tokens-changed";

function dispatchChanged(): void {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token == null || token === "") localStorage.removeItem(ACCESS_KEY);
    else localStorage.setItem(ACCESS_KEY, token);
  } catch {
    // ignore
  }
  dispatchChanged();
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token == null || token === "") localStorage.removeItem(REFRESH_KEY);
    else localStorage.setItem(REFRESH_KEY, token);
  } catch {
    // ignore
  }
  dispatchChanged();
}

export function clearSessionTokens(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
  dispatchChanged();
}

export function subscribeSessionTokens(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = () => listener();
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
}
