/** Matches AuthContext `UserRole` — kept here to avoid circular imports. */
export type BuiltinUserRole = "admin" | "teacher" | "student";

/** Built-in role ids sent to POST /admin { action: assignRole | removeRole } */
export function userRoleToApiId(role: BuiltinUserRole): "ADMIN" | "TEACHER" | "STUDENT" {
  if (role === "admin") return "ADMIN";
  if (role === "teacher") return "TEACHER";
  return "STUDENT";
}

/** UI value: built-in `student`|`teacher`|`admin`, or a custom role id (e.g. `CONTENT_REVIEWER`). */
export function roleSelectionToApiId(selection: string): string {
  const s = selection.trim();
  const lower = s.toLowerCase();
  if (lower === "student" || lower === "teacher" || lower === "admin") {
    return userRoleToApiId(lower as BuiltinUserRole);
  }
  return s.toUpperCase();
}

/** Prefer custom role id for editing when present. */
export function userPrimaryRoleSelection(u: { role: BuiltinUserRole; customRoleId?: string | null }): string {
  if (u.customRoleId?.trim()) return u.customRoleId.trim();
  return u.role;
}
