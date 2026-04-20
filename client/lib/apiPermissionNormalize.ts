/**
 * Map AWS LMS permission tokens to the app's internal `resource:verb` shape
 * (see `LmsPermission` in shared/lms + `can()` in permissions.ts).
 */
export function normalizeApiPermissionToken(token: string): string {
  const t = String(token).trim();
  if (t === "*:*" || t === ":*") return "*:*";
  if (t.startsWith("lessons:")) return `lesson:${t.slice("lessons:".length)}`;
  if (t.startsWith("courses:")) return `course:${t.slice("courses:".length)}`;
  if (t.startsWith("enrollments:")) return `enrollment:${t.slice("enrollments:".length)}`;
  if (t.startsWith("users:")) return `admin:${t.slice("users:".length)}`;
  if (t.startsWith("roles:")) return `admin:${t.slice("roles:".length)}`;
  return t;
}

export function normalizeApiPermissionList(tokens: string[] | undefined): string[] {
  if (!tokens?.length) return [];
  return [...new Set(tokens.map(normalizeApiPermissionToken))];
}
