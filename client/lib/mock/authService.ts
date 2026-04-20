/**
 * Mock auth module — handles register, signin, refresh, signout.
 *
 * ► Replace with real API calls by removing this file and restoring
 *   the fetch-based postModule in learningLabApi.ts.
 */

import { getItem, setItem, STORAGE_KEYS } from "@/lib/mockStorage";
import type { StoredUser } from "./seedData";
import type { LearningLabEnvelope } from "@/lib/learningLabApi";

type Result = { status: number; envelope: LearningLabEnvelope<any> };

function ok<T>(data: T): Result {
  return { status: 200, envelope: { success: true, data } };
}

function fail(status: number, message: string): Result {
  return { status, envelope: { success: false, message } };
}

function generateToken(prefix: string, userId: string): string {
  return `${prefix}_${userId}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function roleClaimToStoredRoleId(role: unknown): "ADMIN" | "TEACHER" | "STUDENT" {
  const r = String(role ?? "student").toLowerCase();
  if (r === "admin" || r === "superadmin") return "ADMIN";
  if (r === "teacher" || r === "manager") return "TEACHER";
  return "STUDENT";
}

function resolveUserFromToken(token: string | null): StoredUser | null {
  if (!token) return null;
  const sessions = getItem<Record<string, string>>(STORAGE_KEYS.sessions, {});
  const userId = sessions[token];
  if (userId) {
    const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
    return users.find((u) => u.userId === userId) ?? null;
  }
  const claims = decodeJwtPayload(token);
  if (!claims || typeof claims.sub !== "string") return null;
  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const existing = users.find((u) => u.userId === claims.sub);
  if (existing) return existing;
  return {
    userId: claims.sub,
    tenantId: String(claims.tid ?? claims.tenantId ?? "unknown"),
    email: String(claims.email ?? ""),
    name: String(
      claims.name ?? (typeof claims.email === "string" ? claims.email.split("@")[0] : "User")
    ),
    roleId: roleClaimToStoredRoleId(claims.role),
    status: "ACTIVE",
    permissionsAllow: [],
    permissionsDeny: [],
    createdAt: new Date().toISOString(),
    resolvedViaJwt: true,
  };
}

export { resolveUserFromToken };

export async function handleAuth(body: any, token: string | null): Promise<Result> {
  const action = body?.action;

  if (action === "register") {
    return handleRegister(body);
  }
  if (action === "signin") {
    return handleSignin(body);
  }
  if (action === "refresh") {
    return handleRefresh(body);
  }
  if (action === "signout") {
    return handleSignout(token);
  }

  return fail(400, `Unknown auth action: ${action}`);
}

/* ------------------------------------------------------------------ */

function handleRegister(body: any): Result {
  const { email, password, tenantId = "t1", name } = body;
  if (!email || !password) return fail(400, "Email and password are required");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return fail(409, "An account with this email already exists");
  }

  const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const newUser: StoredUser = {
    userId,
    tenantId,
    email,
    name: (name && name.trim()) ? name.trim() : (email.split("@")[0] || email),
    roleId: "STUDENT",
    status: "ACTIVE",
    permissionsAllow: ["courses:enroll", "lessons:view", "progress:view_own"],
    permissionsDeny: [],
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  setItem(STORAGE_KEYS.users, users);

  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.passwords, {});
  passwords[email.toLowerCase()] = password;
  setItem(STORAGE_KEYS.passwords, passwords);

  addAudit(userId, newUser.name, "USER_REGISTERED", "auth", userId, `New ${newUser.roleId.toLowerCase()} account registered`);

  return ok({ message: "Registration successful", userId });
}

function handleSignin(body: any): Result {
  const { email, password, tenantId = "t1" } = body;
  if (!email || !password) return fail(400, "Email and password are required");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return fail(401, "Invalid email or password");

  const passwords = getItem<Record<string, string>>(STORAGE_KEYS.passwords, {});
  const stored = passwords[email.toLowerCase()];
  if (stored && stored !== password) return fail(401, "Invalid email or password");

  if (user.status === "DISABLED") return fail(403, "Your account has been disabled. Contact an administrator.");

  const accessToken = generateToken("at", user.userId);
  const refreshToken = generateToken("rt", user.userId);

  const sessions = getItem<Record<string, string>>(STORAGE_KEYS.sessions, {});
  sessions[accessToken] = user.userId;
  sessions[refreshToken] = user.userId;
  setItem(STORAGE_KEYS.sessions, sessions);

  addAudit(user.userId, user.name, "USER_SIGNIN", "auth", undefined, `${user.roleId} signed in`);

  return ok({
    accessToken,
    refreshToken,
    userId: user.userId,
    tenantId: user.tenantId || tenantId,
    name: user.name,
    email: user.email,
    roles: [user.roleId],
    permissions: { allow: user.permissionsAllow, deny: user.permissionsDeny },
  });
}

function handleRefresh(body: any): Result {
  const { refreshToken } = body;
  if (!refreshToken) return fail(401, "Refresh token required");

  const sessions = getItem<Record<string, string>>(STORAGE_KEYS.sessions, {});
  const userId = sessions[refreshToken];
  if (!userId) return fail(401, "Invalid or expired refresh token");

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const user = users.find((u) => u.userId === userId);
  if (!user) return fail(401, "User not found");

  const newAccessToken = generateToken("at", userId);
  sessions[newAccessToken] = userId;
  setItem(STORAGE_KEYS.sessions, sessions);

  return ok({
    accessToken: newAccessToken,
    userId: user.userId,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    roles: [user.roleId],
    permissions: { allow: user.permissionsAllow, deny: user.permissionsDeny },
  });
}

function handleSignout(token: string | null): Result {
  if (token) {
    const sessions = getItem<Record<string, string>>(STORAGE_KEYS.sessions, {});
    delete sessions[token];
    setItem(STORAGE_KEYS.sessions, sessions);
  }
  return ok({ message: "Signed out" });
}

/* ------------------------------------------------------------------ */

function addAudit(userId: string, userName: string, action: string, module: string, resourceId?: string, details: string = "") {
  const audit = getItem<any[]>(STORAGE_KEYS.audit, []);
  audit.push({
    id: `aud_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action,
    module,
    resourceId,
    details,
    ipAddress: "127.0.0.1",
  });
  setItem(STORAGE_KEYS.audit, audit);
}
