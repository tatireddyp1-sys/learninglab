import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { asRecord, extractAccessToken, extractRefreshTokenOptional } from "@/lib/authEnvelopeParse";
import { getEnvelopeError, isFailure, postModule } from "@/lib/learningLabApi";
import * as sessionTokens from "@/lib/sessionTokens";
import { expandApiPermissionsToLms } from "@/lib/permissions";
import { roleSelectionToApiId, userRoleToApiId } from "@/lib/userRoles";

export type UserRole = "admin" | "teacher" | "student";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  customRoleId?: string | null;
  permissionsAllow: string[];
  permissionsDeny: string[];
  isActive: boolean;
  createdAt?: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tenantId: string;
  setTenantId: (tenantId: string) => void;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  accessToken: string | null;
  refreshToken: string | null;
  listUsers: () => Promise<User[]>;
  getUser: (userId: string) => Promise<User>;
  createUser: (input: {
    email: string;
    password: string;
    roleId?: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  updateUser: (
    userId: string,
    updates: {
      email?: string;
      status?: "ACTIVE" | "DISABLED";
      firstName?: string;
      lastName?: string;
    }
  ) => Promise<void>;
  assignRole: (userId: string, roleId: string) => Promise<void>;
  removeRole: (userId: string, roleId: string) => Promise<void>;
  /** Removes previous built-in role, then assigns the new one (matches typical API Gateway behavior). */
  replaceUserRole: (userId: string, previous: UserRole, next: UserRole) => Promise<void>;
  /** Built-in (`student`/`teacher`/`admin`) or custom role id; removes previous then assigns next. */
  replacePrimaryRole: (userId: string, previousSelection: string, nextSelection: string) => Promise<void>;
  disableUser: (userId: string) => Promise<void>;
  enableUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ApiUserPayload = {
  userId?: string;
  id?: string;
  tenantId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  /** Common alternate from APIs (Cognito / Gateway) */
  displayName?: string;
  fullName?: string;
  role?: string;
  roles?: string[];
  permissions?: { allow?: string[]; deny?: string[] };
};

type SigninData = ApiUserPayload & {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  user?: ApiUserPayload;
};

type RefreshData = ApiUserPayload & {
  accessToken: string;
  expiresIn?: number;
  tokenType?: string;
  user?: ApiUserPayload;
};

function coalesceApiUser(d: SigninData | RefreshData): ApiUserPayload {
  if (d.user) return d.user;
  return {
    userId: d.userId,
    id: d.id,
    tenantId: d.tenantId,
    email: d.email,
    firstName: d.firstName,
    lastName: d.lastName,
    name: d.name,
    displayName: d.displayName,
    fullName: d.fullName,
    role: d.role,
    roles: d.roles,
    permissions: d.permissions,
  };
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Persist new tokens (global store + React state). */
function applySessionTokens(
  setAccessToken: (t: string | null) => void,
  setRefreshToken: (t: string | null) => void,
  access: string,
  refresh?: string
) {
  sessionTokens.setAccessToken(access);
  setAccessToken(access);
  if (refresh) {
    sessionTokens.setRefreshToken(refresh);
    setRefreshToken(refresh);
  }
}

function roleFromRoles(roles: string[] | undefined): UserRole {
  const set = new Set((roles ?? []).map((r) => r.toUpperCase()));
  if (set.has("SUPERADMIN") || set.has("ADMIN")) return "admin";
  if (set.has("MANAGER") || set.has("TEACHER")) return "teacher";
  return "student";
}

function roleFromApiUser(u: ApiUserPayload): UserRole {
  if (u.role) {
    const r = String(u.role).toLowerCase();
    if (r === "admin" || r === "superadmin") return "admin";
    if (r === "teacher" || r === "manager") return "teacher";
    return "student";
  }
  return roleFromRoles(u.roles);
}

function mapPermissions(p?: { allow?: string[]; deny?: string[] }) {
  const allow = expandApiPermissionsToLms(p?.allow);
  const deny = expandApiPermissionsToLms(p?.deny);
  return {
    permissionsAllow: allow.map(String),
    permissionsDeny: deny.map(String),
  };
}

function tryParseStoredUser(): User | null {
  try {
    const raw = readLocal("learninglab_user");
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<User>;
    if (o && typeof o.id === "string" && typeof o.email === "string") return o as User;
    return null;
  } catch {
    return null;
  }
}

function buildUserFromApi(u: ApiUserPayload, fallbackTenant: string, fallbackEmail?: string): User {
  const id = String(u.userId ?? u.id ?? "");
  const name =
    u.name?.trim() ||
    u.displayName?.trim() ||
    u.fullName?.trim() ||
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
    u.email?.split("@")[0] ||
    "User";
  const { permissionsAllow, permissionsDeny } = mapPermissions(u.permissions);
  return {
    id,
    tenantId: String(u.tenantId ?? fallbackTenant),
    email: String(u.email ?? fallbackEmail ?? ""),
    name,
    firstName: u.firstName,
    lastName: u.lastName,
    role: roleFromApiUser(u),
    permissionsAllow,
    permissionsDeny,
    isActive: true,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantIdState] = useState(() => readLocal("learninglab_tenant_id") ?? "test-tenant-001");
  const [accessToken, setAccessToken] = useState<string | null>(() => sessionTokens.getAccessToken());
  const [refreshToken, setRefreshToken] = useState<string | null>(() => sessionTokens.getRefreshToken());

  useEffect(() => {
    return sessionTokens.subscribeSessionTokens(() => {
      setAccessToken(sessionTokens.getAccessToken());
      setRefreshToken(sessionTokens.getRefreshToken());
    });
  }, []);

  useEffect(() => {
    try {
      if (sessionTokens.getAccessToken()) {
        const restored = tryParseStoredUser();
        if (restored) setUser(restored);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setTenantId = useCallback((next: string) => {
    const trimmed = next.trim() || "test-tenant-001";
    setTenantIdState(trimmed);
    writeLocal("learninglab_tenant_id", trimmed);
  }, []);

  const login = useCallback(
    async (email: string, password: string, tenantOverride?: string) => {
      const tid = (tenantOverride ?? tenantId).trim() || "test-tenant-001";
      const { envelope } = await postModule<
        { action: "signin"; tenantId: string; email: string; password: string },
        SigninData
      >("auth", { action: "signin", tenantId: tid, email, password });

      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));

      const d = envelope.data;
      const access = extractAccessToken(d);
      const newRefresh = extractRefreshTokenOptional(d);
      const u = coalesceApiUser({ ...(asRecord(d) ?? {}), accessToken: access } as SigninData);
      if (!u.userId && !u.id && !u.email) throw new Error("Invalid sign-in response: missing user");

      applySessionTokens(setAccessToken, setRefreshToken, access, newRefresh);
      setTenantId(tid);

      const nextUser = buildUserFromApi(u, tid, email);
      setUser(nextUser);
      writeLocal("learninglab_user", JSON.stringify(nextUser));
    },
    [tenantId, setTenantId]
  );

  const logout = useCallback(() => {
    setUser(null);
    sessionTokens.clearSessionTokens();
    setAccessToken(null);
    setRefreshToken(null);
    writeLocal("learninglab_user", null);
    void postModule("auth", { action: "signout" } as { action: "signout" }).catch(() => {});
  }, []);

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(user.role);
    },
    [user]
  );

  const mapRowToUser = useCallback((u: Record<string, unknown>, fallbackTenant: string): User => {
    const row = u as ApiUserPayload & { status?: string; roleId?: string; customRoleId?: string | null };
    const roles = row.roles ?? (row.roleId ? [row.roleId] : undefined);
    const isActive = String(row.status ?? "ACTIVE").toUpperCase() !== "DISABLED";
    const base = buildUserFromApi({ ...row, roles }, fallbackTenant);
    const customRoleId = row.customRoleId != null && String(row.customRoleId).trim() !== "" ? String(row.customRoleId) : null;
    return { ...base, isActive, customRoleId };
  }, []);

  const getUser = useCallback(
    async (userId: string): Promise<User> => {
      const { envelope } = await postModule<{ action: "getUser"; userId: string }, ApiUserPayload>(
        "admin",
        { action: "getUser", userId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      return mapRowToUser(envelope.data as unknown as Record<string, unknown>, tenantId);
    },
    [accessToken, tenantId, mapRowToUser]
  );

  const listUsers = useCallback(async (): Promise<User[]> => {
    const { envelope } = await postModule<{ action: "listUsers" }, { items?: unknown[]; totalItems?: number }>(
      "admin",
      { action: "listUsers" },
      { accessToken }
    );
    if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
    const data = envelope.data as { items?: unknown[] } | unknown[] | undefined;
    const raw = Array.isArray(data) ? data : data?.items ?? [];
    const rows = Array.isArray(raw) ? raw : [];
    const mapped: User[] = [];
    for (const row of rows) {
      const r = row as ApiUserPayload & { status?: string; userId?: string };
      if (r.role || (r.roles && r.roles.length) || (r as { roleId?: string }).roleId) {
        mapped.push(mapRowToUser(r as Record<string, unknown>, tenantId));
        continue;
      }
      try {
        const uid = String(r.userId ?? (r as { id?: string }).id ?? "");
        if (uid) mapped.push(await getUser(uid));
        else mapped.push(mapRowToUser(r as Record<string, unknown>, tenantId));
      } catch {
        mapped.push(mapRowToUser(r as Record<string, unknown>, tenantId));
      }
    }
    return mapped;
  }, [accessToken, tenantId, mapRowToUser, getUser]);

  const createUser = useCallback(
    async (input: {
      email: string;
      password: string;
      roleId?: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const { envelope } = await postModule<
        {
          action: "createUser";
          email: string;
          password: string;
          roleId?: string;
          firstName?: string;
          lastName?: string;
        },
        { userId: string }
      >(
        "admin",
        {
          action: "createUser",
          email: input.email,
          password: input.password,
          roleId: input.roleId ?? "STUDENT",
          firstName: input.firstName,
          lastName: input.lastName,
        },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
    },
    [accessToken]
  );

  const updateUser = useCallback(
    async (
      userId: string,
      updates: {
        email?: string;
        status?: "ACTIVE" | "DISABLED";
        firstName?: string;
        lastName?: string;
      }
    ) => {
      const { envelope } = await postModule<
        {
          action: "updateUser";
          userId: string;
          email?: string;
          status?: "ACTIVE" | "DISABLED";
          firstName?: string;
          lastName?: string;
        },
        { userId: string; updated: boolean }
      >("admin", { action: "updateUser", userId, ...updates }, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
    },
    [accessToken]
  );

  const assignRole = useCallback(async (userId: string, roleId: string) => {
    const { envelope } = await postModule<{ action: "assignRole"; userId: string; roleId: string }, unknown>(
      "admin",
      { action: "assignRole", userId, roleId },
      { accessToken }
    );
    if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
  }, [accessToken]);

  const removeRole = useCallback(async (userId: string, roleId: string) => {
    const { envelope } = await postModule<{ action: "removeRole"; userId: string; roleId: string }, unknown>(
      "admin",
      { action: "removeRole", userId, roleId },
      { accessToken }
    );
    if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
  }, [accessToken]);

  const replaceUserRole = useCallback(
    async (userId: string, previous: UserRole, next: UserRole) => {
      const prevId = userRoleToApiId(previous);
      const nextId = userRoleToApiId(next);
      if (prevId === nextId) return;

      const rm = await postModule<{ action: "removeRole"; userId: string; roleId: string }, unknown>(
        "admin",
        { action: "removeRole", userId, roleId: prevId },
        { accessToken }
      );
      if (isFailure(rm.envelope)) {
        const msg = getEnvelopeError(rm.envelope);
        if (!/not\s*(assigned|found)|does\s*not|no\s*such|404|unknown role/i.test(msg)) {
          throw new Error(msg);
        }
      }

      const as = await postModule<{ action: "assignRole"; userId: string; roleId: string }, unknown>(
        "admin",
        { action: "assignRole", userId, roleId: nextId },
        { accessToken }
      );
      if (isFailure(as.envelope)) throw new Error(getEnvelopeError(as.envelope));
    },
    [accessToken]
  );

  const replacePrimaryRole = useCallback(
    async (userId: string, previousSelection: string, nextSelection: string) => {
      const prevId = roleSelectionToApiId(previousSelection);
      const nextId = roleSelectionToApiId(nextSelection);
      if (prevId === nextId) return;

      const rm = await postModule<{ action: "removeRole"; userId: string; roleId: string }, unknown>(
        "admin",
        { action: "removeRole", userId, roleId: prevId },
        { accessToken }
      );
      if (isFailure(rm.envelope)) {
        const msg = getEnvelopeError(rm.envelope);
        if (!/not\s*(assigned|found)|does\s*not|no\s*such|404|unknown role/i.test(msg)) {
          throw new Error(msg);
        }
      }

      const as = await postModule<{ action: "assignRole"; userId: string; roleId: string }, unknown>(
        "admin",
        { action: "assignRole", userId, roleId: nextId },
        { accessToken }
      );
      if (isFailure(as.envelope)) throw new Error(getEnvelopeError(as.envelope));
    },
    [accessToken]
  );

  const disableUser = useCallback(async (userId: string) => {
    const { envelope } = await postModule<{ action: "disableUser"; userId: string }, { userId: string; status: string }>(
      "admin",
      { action: "disableUser", userId },
      { accessToken }
    );
    if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
  }, [accessToken]);

  const enableUser = useCallback(async (userId: string) => {
    const { envelope } = await postModule<{ action: "enableUser"; userId: string }, { userId: string; status: string }>(
      "admin",
      { action: "enableUser", userId },
      { accessToken }
    );
    if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
  }, [accessToken]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      tenantId,
      setTenantId,
      login,
      logout,
      hasRole,
      accessToken,
      refreshToken,
      listUsers,
      getUser,
      createUser,
      updateUser,
      assignRole,
      removeRole,
      replaceUserRole,
      replacePrimaryRole,
      disableUser,
      enableUser,
    }),
    [
      user,
      isLoading,
      tenantId,
      setTenantId,
      login,
      logout,
      hasRole,
      accessToken,
      refreshToken,
      listUsers,
      getUser,
      createUser,
      updateUser,
      assignRole,
      removeRole,
      replaceUserRole,
      replacePrimaryRole,
      disableUser,
      enableUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
