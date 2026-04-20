/**
 * Mock admin module — user CRUD, role CRUD, audit log listing.
 *
 * ► Replace with real API calls by removing this file.
 */

import { getItem, setItem, STORAGE_KEYS } from "@/lib/mockStorage";
import type { StoredUser, StoredRole, StoredAuditEntry } from "./seedData";
import { resolveUserFromToken } from "./authService";
import type { LearningLabEnvelope } from "@/lib/learningLabApi";

type Result = { status: number; envelope: LearningLabEnvelope<any> };

function ok<T>(data: T): Result {
  return { status: 200, envelope: { success: true, data } };
}
function fail(status: number, message: string): Result {
  return { status, envelope: { success: false, message } };
}

export async function handleAdmin(body: any, token: string | null): Promise<Result> {
  const action = body?.action;
  const caller = resolveUserFromToken(token);

  switch (action) {
    case "listUsers":
      return listUsers();
    case "getUser":
      return getUser(body.userId);
    case "createUser":
      return createUser(body, caller);
    case "updateUser":
      return updateUser(body);
    case "assignRole":
      return assignRole(body);
    case "removeRole":
      return removeRole(body);
    case "disableUser":
      return toggleUser(body.userId, "DISABLED");
    case "enableUser":
      return toggleUser(body.userId, "ACTIVE");
    case "listRoles":
      return listRoles();
    case "createRole":
      return createRole(body, caller);
    case "updateRole":
      return updateRole(body, caller);
    case "deleteRole":
      return deleteRole(body.roleId);
    case "listAuditLogs":
      return listAuditLogs(body);
    default:
      return fail(400, `Unknown admin action: ${action}`);
  }
}

/* ── Users ─────────────────────────────────────────────────────────── */

function listUsers(): Result {
  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  return ok({ items: users, totalItems: users.length });
}

function getUser(userId: string): Result {
  if (!userId) return fail(400, "userId is required");
  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const u = users.find((x) => x.userId === userId);
  if (!u) return fail(404, "User not found");
  const parts = u.name.trim().split(/\s+/);
  return ok({
    userId: u.userId,
    tenantId: u.tenantId,
    email: u.email,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || "",
    name: u.name,
    roles: u.customRoleId ? [u.roleId, u.customRoleId] : [u.roleId],
    role: u.roleId.toLowerCase(),
    customRoleId: u.customRoleId ?? null,
    permissions: { allow: u.permissionsAllow, deny: u.permissionsDeny },
    status: u.status,
  });
}

const BUILTIN_PERM_MAP: Record<string, string[]> = {
  ADMIN: ["*:*"],
  TEACHER: [
    "courses:create", "courses:edit_own", "courses:delete_own", "courses:publish_own", "courses:enroll",
    "lessons:create", "lessons:edit", "lessons:view", "lessons:delete",
    "enrollments:manage", "progress:view_course", "progress:view_own",
    "roles:manage",
  ],
  STUDENT: ["courses:enroll", "lessons:view", "progress:view_own"],
};

/** Idempotent: succeeds if the user does not currently have this role (for replace pipelines). */
function removeRole(body: any): Result {
  const { userId, roleId } = body;
  if (!userId || !roleId) return fail(400, "userId and roleId are required");

  const rid = String(roleId).toUpperCase();

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const idx = users.findIndex((u) => u.userId === userId);
  if (idx === -1) return fail(404, "User not found");

  if (rid === "ADMIN" || rid === "TEACHER" || rid === "STUDENT") {
    if (users[idx].roleId !== rid) {
      return ok({ userId, roleId: rid, removed: false });
    }
    users[idx].roleId = "STUDENT";
    users[idx].permissionsAllow = BUILTIN_PERM_MAP.STUDENT;
    setItem(STORAGE_KEYS.users, users);
    return ok({ userId, roleId: rid, removed: true });
  }

  const current = String(users[idx].customRoleId ?? "").toUpperCase();
  if (current !== rid) {
    return ok({ userId, roleId: rid, removed: false });
  }
  users[idx].customRoleId = null;
  users[idx].permissionsAllow = BUILTIN_PERM_MAP[users[idx].roleId] ?? BUILTIN_PERM_MAP.STUDENT;
  setItem(STORAGE_KEYS.users, users);
  return ok({ userId, roleId: rid, removed: true });
}

function assignRole(body: any): Result {
  const { userId, roleId } = body;
  if (!userId || !roleId) return fail(400, "userId and roleId are required");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const idx = users.findIndex((u) => u.userId === userId);
  if (idx === -1) return fail(404, "User not found");

  const rid = String(roleId).toUpperCase();
  if (rid === "ADMIN" || rid === "TEACHER" || rid === "STUDENT") {
    users[idx].roleId = rid as StoredUser["roleId"];
    users[idx].customRoleId = null;
    users[idx].permissionsAllow = BUILTIN_PERM_MAP[rid] ?? BUILTIN_PERM_MAP.STUDENT;
  } else {
    const roles = getItem<StoredRole[]>(STORAGE_KEYS.roles, []);
    const def = roles.find((r) => r.roleId.toUpperCase() === rid);
    users[idx].roleId = "STUDENT";
    users[idx].customRoleId = rid;
    users[idx].permissionsAllow =
      def?.policies?.allow?.length ? [...def.policies.allow] : BUILTIN_PERM_MAP.STUDENT;
  }
  setItem(STORAGE_KEYS.users, users);
  return ok({ userId, roleId: rid });
}

function createUser(body: any, caller: StoredUser | null): Result {
  const { email, password, roleId = "STUDENT", firstName, lastName } = body;
  if (!email || !password) return fail(400, "Email and password are required");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return fail(409, "A user with this email already exists");
  }

  const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    (typeof body.name === "string" ? body.name.trim() : "") ||
    email.split("@")[0] ||
    email;

  const ridUpper = String(roleId).toUpperCase();
  let newUser: StoredUser;
  if (ridUpper === "ADMIN" || ridUpper === "TEACHER" || ridUpper === "STUDENT") {
    newUser = {
      userId,
      tenantId: caller?.tenantId ?? "t1",
      email,
      name: displayName,
      roleId: ridUpper as StoredUser["roleId"],
      status: "ACTIVE",
      customRoleId: null,
      permissionsAllow: BUILTIN_PERM_MAP[ridUpper] ?? BUILTIN_PERM_MAP.STUDENT,
      permissionsDeny: [],
      createdAt: new Date().toISOString(),
    };
  } else {
    const roles = getItem<StoredRole[]>(STORAGE_KEYS.roles, []);
    const def = roles.find((r) => r.roleId.toUpperCase() === ridUpper);
    newUser = {
      userId,
      tenantId: caller?.tenantId ?? "t1",
      email,
      name: displayName,
      roleId: "STUDENT",
      status: "ACTIVE",
      customRoleId: ridUpper,
      permissionsAllow: def?.policies?.allow?.length ? [...def.policies.allow] : BUILTIN_PERM_MAP.STUDENT,
      permissionsDeny: [],
      createdAt: new Date().toISOString(),
    };
  }

  users.push(newUser);
  setItem(STORAGE_KEYS.users, users);

  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.passwords, {});
  passwords[email.toLowerCase()] = password;
  setItem(STORAGE_KEYS.passwords, passwords);

  appendAudit(caller, "USER_CREATED", "admin", userId, `Created user ${email} with role ${roleId}`);

  return ok({ userId, tenantId: newUser.tenantId, roleId });
}

function updateUser(body: any): Result {
  const { userId, email, status, firstName, lastName } = body;
  if (!userId) return fail(400, "userId is required");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const idx = users.findIndex((u) => u.userId === userId);
  if (idx === -1) return fail(404, "User not found");

  if (email !== undefined) users[idx].email = email;
  if (status !== undefined) users[idx].status = status;
  if (firstName !== undefined || lastName !== undefined) {
    const parts = users[idx].name.trim().split(/\s+/);
    const fn = firstName !== undefined ? String(firstName).trim() : parts[0] ?? "";
    const ln = lastName !== undefined ? String(lastName).trim() : parts.slice(1).join(" ");
    users[idx].name = [fn, ln].filter(Boolean).join(" ").trim() || users[idx].name;
  }
  setItem(STORAGE_KEYS.users, users);

  return ok({ userId, updated: true });
}

function toggleUser(userId: string, status: "ACTIVE" | "DISABLED"): Result {
  if (!userId) return fail(400, "userId is required");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const idx = users.findIndex((u) => u.userId === userId);
  if (idx === -1) return fail(404, "User not found");

  users[idx].status = status;
  setItem(STORAGE_KEYS.users, users);

  return ok({ userId, status });
}

/* ── Roles ─────────────────────────────────────────────────────────── */

function listRoles(): Result {
  const roles = getItem<StoredRole[]>(STORAGE_KEYS.roles, []);
  return ok(roles);
}

function createRole(body: any, caller: StoredUser | null): Result {
  const { roleId, roleName, displayName, status = "ACTIVE", isSystem = false, policies, permissions } = body;
  if (!roleId) return fail(400, "roleId is required");

  const roles = getItem<StoredRole[]>(STORAGE_KEYS.roles, []);
  if (roles.some((r) => r.roleId === roleId)) {
    return fail(409, "A role with this ID already exists");
  }

  const policySource = policies ?? permissions;
  const normalizedPolicies =
    policySource && typeof policySource === "object" && ("allow" in policySource || "deny" in policySource)
      ? policySource
      : { allow: [], deny: [] };

  const now = new Date().toISOString();
  const newRole: StoredRole = {
    roleId,
    displayName: displayName || roleId,
    roleName: roleName || displayName || roleId,
    status: status as "ACTIVE",
    isSystem,
    policies: normalizedPolicies as { allow: string[]; deny: string[] },
    createdAt: now,
    updatedAt: now,
  };

  roles.push(newRole);
  setItem(STORAGE_KEYS.roles, roles);

  appendAudit(caller, "ROLE_CREATED", "admin", roleId, `Created custom role: ${displayName || roleId}`);

  return ok({ roleId });
}

function updateRole(body: any, caller: StoredUser | null): Result {
  const { roleId, displayName, status, policies, permissions } = body;
  if (!roleId) return fail(400, "roleId is required");

  const roles = getItem<StoredRole[]>(STORAGE_KEYS.roles, []);
  const idx = roles.findIndex((r) => r.roleId === roleId);
  if (idx === -1) return fail(404, "Role not found");

  if (displayName !== undefined) roles[idx].displayName = displayName;
  if (status !== undefined) roles[idx].status = status;
  const nextPolicies = policies ?? permissions;
  if (nextPolicies !== undefined) roles[idx].policies = nextPolicies;
  roles[idx].updatedAt = new Date().toISOString();
  setItem(STORAGE_KEYS.roles, roles);

  appendAudit(caller, "ROLE_UPDATED", "admin", roleId, `Updated custom role: ${displayName || roleId}`);

  return ok({ roleId });
}

function deleteRole(roleId: string): Result {
  if (!roleId) return fail(400, "roleId is required");
  const roles = getItem<StoredRole[]>(STORAGE_KEYS.roles, []);
  const idx = roles.findIndex((r) => r.roleId === roleId);
  if (idx === -1) return fail(404, "Role not found");
  roles.splice(idx, 1);
  setItem(STORAGE_KEYS.roles, roles);
  return ok({ roleId, deleted: true });
}

/* ── Audit ─────────────────────────────────────────────────────────── */

function listAuditLogs(body: any): Result {
  const logs = getItem<StoredAuditEntry[]>(STORAGE_KEYS.audit, []);
  const page = Number(body?.page ?? 1);
  const limit = Number(body?.limit ?? 50);
  const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const start = (page - 1) * limit;
  return ok({ logs: sorted.slice(start, start + limit), total: sorted.length });
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function appendAudit(caller: StoredUser | null, action: string, module: string, resourceId?: string, details = "") {
  const audit = getItem<StoredAuditEntry[]>(STORAGE_KEYS.audit, []);
  audit.push({
    id: `aud_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    userId: caller?.userId ?? "system",
    userName: caller?.name ?? "System",
    action,
    module,
    resourceId,
    details,
    ipAddress: "127.0.0.1",
  });
  setItem(STORAGE_KEYS.audit, audit);
}
