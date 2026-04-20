/** Parse access/refresh tokens from auth signin/refresh API payloads (camelCase, snake_case, nested `data`). */

export function asRecord(v: unknown): Record<string, unknown> | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

export function extractAccessToken(data: unknown): string {
  const o = asRecord(data);
  if (!o) throw new Error("Invalid auth response: missing data");
  const nested = asRecord(o.data);
  const raw =
    o.accessToken ??
    o.access_token ??
    o.token ??
    nested?.accessToken ??
    nested?.access_token ??
    nested?.token;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) throw new Error("Invalid auth response: missing access token");
  return s;
}

export function extractRefreshTokenOptional(data: unknown): string | undefined {
  const o = asRecord(data);
  if (!o) return undefined;
  const nested = asRecord(o.data);
  const raw =
    o.refreshToken ?? o.refresh_token ?? nested?.refreshToken ?? nested?.refresh_token;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  return s || undefined;
}
