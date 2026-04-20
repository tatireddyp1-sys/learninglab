import type { User, UserRole } from "@/context/AuthContext";
import type { Course, CustomRole, LmsPermission } from "@shared/lms";

export interface PermissionContext {
  course?: Course | null;
}

/** Full list for role editors and matrices */
export const ALL_LMS_PERMISSIONS: LmsPermission[] = [
  "course:create",
  "course:edit_any",
  "course:edit_own",
  "course:delete_any",
  "course:delete_own",
  "course:publish_own",
  "course:enroll",
  "lesson:create",
  "lesson:edit",
  "lesson:view",
  "lesson:delete",
  "enrollment:manage",
  "progress:view_all",
  "progress:view_own",
  "progress:view_course",
  "admin:users",
  "admin:roles",
  "admin:audit",
];

/** Human-readable labels for the role editor (shown next to the permission key). */
export const PERMISSION_LABELS: Record<LmsPermission, string> = {
  "course:create": "Create new courses",
  "course:edit_any": "Edit any course (full catalog)",
  "course:edit_own": "Edit only courses you own",
  "course:delete_any": "Delete any course",
  "course:delete_own": "Delete only your own courses",
  "course:publish_own": "Publish or unpublish your courses",
  "course:enroll": "Enroll in courses as a learner",
  "lesson:create": "Create lessons in courses you can edit",
  "lesson:edit": "Edit lessons (follows course ownership)",
  "lesson:view": "View lesson content",
  "lesson:delete": "Delete lessons",
  "enrollment:manage": "Manage rosters and enrollments",
  "progress:view_all": "View all learners’ progress (platform-wide)",
  "progress:view_own": "View your own progress only",
  "progress:view_course": "View progress for your courses’ learners",
  "admin:users": "Manage users and role assignments",
  "admin:roles": "Create and edit custom roles",
  "admin:audit": "View audit and system logs",
};

const PERMISSION_SECTION_ORDER = ["course", "lesson", "enrollment", "progress", "admin"] as const;

const PERMISSION_SECTION_META: Record<
  (typeof PERMISSION_SECTION_ORDER)[number],
  { title: string; description: string }
> = {
  course: {
    title: "Courses",
    description: "Catalog, drafts, publishing, and joining courses.",
  },
  lesson: {
    title: "Lessons",
    description: "Authoring and viewing lesson content.",
  },
  enrollment: {
    title: "Enrollments",
    description: "Class rosters and enrollment operations.",
  },
  progress: {
    title: "Progress & analytics",
    description: "Who can see completion and activity data.",
  },
  admin: {
    title: "Platform administration",
    description: "User directory and compliance visibility.",
  },
};

export interface PermissionEditorGroup {
  id: string;
  title: string;
  description: string;
  permissions: LmsPermission[];
}

/** Grouped list for the custom-role editor (stable order, one section per resource). */
export function getPermissionEditorGroups(): PermissionEditorGroup[] {
  const byPrefix = new Map<string, LmsPermission[]>();
  for (const p of ALL_LMS_PERMISSIONS) {
    const prefix = p.split(":")[0] as (typeof PERMISSION_SECTION_ORDER)[number];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix)!.push(p);
  }
  return PERMISSION_SECTION_ORDER.filter((id) => byPrefix.has(id)).map((id) => ({
    id,
    ...PERMISSION_SECTION_META[id],
    permissions: byPrefix.get(id) ?? [],
  }));
}

const ROLE_DEFAULTS: Record<UserRole, LmsPermission[]> = {
  admin: [
    "course:create",
    "course:edit_any",
    "course:delete_any",
    "course:publish_own",
    "course:enroll",
    "lesson:create",
    "lesson:edit",
    "lesson:view",
    "lesson:delete",
    "enrollment:manage",
    "progress:view_all",
    "progress:view_own",
    "progress:view_course",
    "admin:users",
    "admin:roles",
    "admin:audit",
  ],
  teacher: [
    "course:create",
    "course:edit_own",
    "course:delete_own",
    "course:publish_own",
    "course:enroll",
    "lesson:create",
    "lesson:edit",
    "lesson:view",
    "lesson:delete",
    "enrollment:manage",
    "progress:view_course",
    "progress:view_own",
    "admin:roles",
  ],
  student: ["course:enroll", "lesson:view", "progress:view_own"],
};

/** Built-in presets (admin / teacher / student) — used when the user has no `customRoleId`. */
export function getRolePermissions(role: UserRole): Set<LmsPermission> {
  return new Set(ROLE_DEFAULTS[role] ?? []);
}

/**
 * Effective permission set: custom role overrides built-in preset when `user.customRoleId` matches.
 */
export function getEffectivePermissions(
  user: (Pick<User, "role"> & Partial<Pick<User, "permissionsAllow" | "permissionsDeny">>) | null | undefined,
  customRoles: CustomRole[]
): Set<LmsPermission> {
  if (!user) return new Set();

  const allow = (user.permissionsAllow ?? []).map(normalizePermissionToken);
  const deny = (user.permissionsDeny ?? []).map(normalizePermissionToken);
  if (allow.length > 0 || deny.length > 0) {
    return new Set(allow.filter((p): p is LmsPermission => ALL_LMS_PERMISSIONS.includes(p as any)));
  }

  const anyUser = user as any;
  if (anyUser.customRoleId) {
    const cr = customRoles.find((c) => c.id === anyUser.customRoleId);
    if (cr) return new Set(cr.permissions);
  }
  return getRolePermissions(user.role);
}

export function isCourseOwner(course: Course | null | undefined, userId: string | undefined): boolean {
  return !!(course && userId && course.createdBy === userId);
}

/** Creator or assigned teacher (`teacherIds` from COURSES API). */
export function isCourseManager(course: Course | null | undefined, userId: string | undefined): boolean {
  if (!course || !userId) return false;
  if (isCourseOwner(course, userId)) return true;
  return course.teacherIds?.some((t) => String(t).trim() === String(userId).trim()) ?? false;
}

function normalizePermissionToken(token: string): string {
  if (token === "*:*") return "*:*";
  if (token.startsWith("courses:")) return `course:${token.slice("courses:".length)}`;
  if (token.startsWith("lessons:")) return `lesson:${token.slice("lessons:".length)}`;
  if (token.startsWith("enrollments:")) return `enrollment:${token.slice("enrollments:".length)}`;
  return token;
}

function matchesToken(grant: string, needed: string): boolean {
  const g = normalizePermissionToken(grant);
  const n = normalizePermissionToken(needed);
  if (g === "*:*") return true;
  const [gm, ga] = g.split(":");
  const [nm, na] = n.split(":");
  if (!gm || !ga || !nm || !na) return false;
  if (gm === nm && ga === "*") return true;
  return g === n;
}

export function can(
  user: (Pick<User, "id" | "role"> & Partial<Pick<User, "permissionsAllow" | "permissionsDeny">>) | null | undefined,
  customRoles: CustomRole[],
  permission: LmsPermission,
  ctx: PermissionContext & { userId?: string }
): boolean {
  if (!user) return false;

  const allow = user.permissionsAllow ?? [];
  const deny = user.permissionsDeny ?? [];
  if (allow.length > 0 || deny.length > 0) {
    if (deny.some((d) => matchesToken(d, permission))) return false;
    const isAllowed = allow.some((a) => matchesToken(a, permission));
    if (!isAllowed) return false;
    if (permission === "course:edit_own" || permission === "course:publish_own") {
      return isCourseManager(ctx.course, ctx.userId);
    }
    if (permission === "course:delete_own") {
      return isCourseOwner(ctx.course, ctx.userId);
    }
    if (permission === "lesson:edit" || permission === "lesson:delete") {
      if (allow.some((a) => matchesToken(a, "course:edit_any"))) return true;
      return isCourseManager(ctx.course, ctx.userId);
    }
    return true;
  }

  const perms = getEffectivePermissions(user, customRoles);
  if (perms.has(permission)) {
    if (permission === "course:edit_own" || permission === "course:publish_own") {
      return isCourseManager(ctx.course, ctx.userId);
    }
    if (permission === "course:delete_own") {
      return isCourseOwner(ctx.course, ctx.userId);
    }
    if (permission === "lesson:edit" || permission === "lesson:delete") {
      if (perms.has("course:edit_any")) return true;
      return isCourseManager(ctx.course, ctx.userId);
    }
    return true;
  }
  if (permission === "course:edit_any" && perms.has("course:edit_any")) return true;
  if (permission === "course:delete_any" && perms.has("course:delete_any")) return true;
  if (permission === "progress:view_all" && perms.has("progress:view_all")) return true;
  return false;
}

export function canCreateCourse(user: User | null | undefined, customRoles: CustomRole[]): boolean {
  if (!user) return false;
  if (can(user, customRoles, "course:create", {})) return true;
  /**
   * Live API JWTs often grant `courses:edit` / `courses:edit_own` without `courses:create`.
   * Teachers who can manage their own courses should still open “Create course” (API remains authoritative).
   */
  if (user.role === "teacher") {
    const deny = user.permissionsDeny ?? [];
    if (deny.some((d) => matchesToken(d, "course:create"))) return false;
    const allow = user.permissionsAllow ?? [];
    if (allow.length === 0) return getRolePermissions("teacher").has("course:create");
    return allow.some(
      (a) =>
        matchesToken(a, "course:edit_own") ||
        matchesToken(a, "course:publish_own") ||
        matchesToken(a, "course:delete_own") ||
        matchesToken(a, "course:edit_any") ||
        matchesToken(a, "course:create")
    );
  }
  return false;
}

export function canEditCourse(
  user: User | null | undefined,
  customRoles: CustomRole[],
  course: Course | undefined,
  userId: string | undefined
): boolean {
  if (!user || !course) return false;
  if (course.status === "deleted") return false;
  if (can(user, customRoles, "course:edit_any", { course, userId })) return true;
  return can(user, customRoles, "course:edit_own", { course, userId });
}

export function canDeleteCourse(
  user: User | null | undefined,
  customRoles: CustomRole[],
  course: Course | undefined,
  userId: string | undefined
): boolean {
  if (!user || !course) return false;
  if (course.status === "deleted") return false;
  if (can(user, customRoles, "course:delete_any", { course, userId })) return true;
  return can(user, customRoles, "course:delete_own", { course, userId });
}

export function canPublishCourse(
  user: User | null | undefined,
  customRoles: CustomRole[],
  course: Course | undefined,
  userId: string | undefined
): boolean {
  if (!user || !course) return false;
  if (course.status === "deleted") return false;
  return (
    can(user, customRoles, "course:publish_own", { course, userId }) ||
    can(user, customRoles, "course:edit_any", { course, userId })
  );
}

export function canAccessAdminNav(user: User | null | undefined, customRoles: CustomRole[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return (
    can(user, customRoles, "admin:users", {}) ||
    can(user, customRoles, "admin:roles", {}) ||
    can(user, customRoles, "admin:audit", {})
  );
}

/** Map API gateway permission strings (e.g. `courses:view`, `lessons:*`) to `LmsPermission`. */
export function expandApiPermissionsToLms(tokens: string[] | undefined): LmsPermission[] {
  if (!tokens?.length) return [];
  const out = new Set<LmsPermission>();

  for (const raw of tokens) {
    const t = String(raw).trim();
    if (!t) continue;

    if (t === "*:*" || t === ":*" || t === ":") {
      ALL_LMS_PERMISSIONS.forEach((p) => out.add(p));
      continue;
    }
    if (t === "lessons:*" || t === "lesson:*") {
      ALL_LMS_PERMISSIONS.filter((p) => p.startsWith("lesson:")).forEach((p) => out.add(p));
      continue;
    }
    if (t === "courses:*" || t === "course:*") {
      ALL_LMS_PERMISSIONS.filter((p) => p.startsWith("course:")).forEach((p) => out.add(p));
      continue;
    }
    if (t === "enrollments:*" || t === "enrollment:*") {
      ALL_LMS_PERMISSIONS.filter((p) => p.startsWith("enrollment:")).forEach((p) => out.add(p));
      continue;
    }

    const n = normalizeApiPermissionToken(t) as LmsPermission;
    if (ALL_LMS_PERMISSIONS.includes(n)) out.add(n);

    if (t === "courses:edit" || t === "course:edit") {
      out.add("course:edit_own");
      out.add("course:publish_own");
      out.add("course:create");
    }
    if (t === "courses:edit_own" || t === "course:edit_own") {
      out.add("course:edit_own");
      out.add("course:publish_own");
      out.add("course:create");
    }
    if (t === "courses:view" || t === "course:view") {
      out.add("course:enroll");
      out.add("lesson:view");
    }
    if (t === "enrollments:view") {
      out.add("enrollment:manage");
    }
    if (t === "progress:view") {
      out.add("progress:view_course");
      out.add("progress:view_own");
    }
    if (t === "progress:update") {
      out.add("progress:view_own");
    }
    if (t.startsWith("users:")) {
      out.add("admin:users");
    }
    if (t.startsWith("roles:")) {
      out.add("admin:roles");
    }
  }

  return [...out];
}

function normalizeApiPermissionToken(token: string): string {
  const x = String(token).trim();
  if (x.startsWith("lessons:")) return `lesson:${x.slice("lessons:".length)}`;
  if (x.startsWith("courses:")) return `course:${x.slice("courses:".length)}`;
  if (x.startsWith("enrollments:")) return `enrollment:${x.slice("enrollments:".length)}`;
  return x;
}
