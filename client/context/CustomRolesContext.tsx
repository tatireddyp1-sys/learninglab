import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CustomRole, LmsPermission } from "@shared/lms";
import { getEnvelopeError, isFailure, postModule } from "@/lib/learningLabApi";
import { useAuth } from "@/context/AuthContext";

interface CustomRolesContextValue {
  roles: CustomRole[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createRole: (input: { name: string; description?: string; permissions: LmsPermission[] }) => Promise<CustomRole>;
  updateRole: (id: string, patch: Partial<Pick<CustomRole, "name" | "description" | "permissions">>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
}

const CustomRolesContext = createContext<CustomRolesContextValue | undefined>(undefined);

export function CustomRolesProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { envelope } = await postModule<{ action: "listRoles" }, any>("admin", { action: "listRoles" }, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const list = Array.isArray(envelope.data) ? envelope.data : [];
      const mapped: CustomRole[] = list.map((r: any) => {
        const allow = (r.policies?.allow ?? r.Policies?.allow ?? r.permissions?.allow ?? []) as string[];
        const perms = allow
          .map((p) => String(p))
          // backend uses courses:* / lessons:* / enrollments:*; UI uses singular
          .map((p) =>
            p.startsWith("courses:") ? `course:${p.slice("courses:".length)}` :
            p.startsWith("lessons:") ? `lesson:${p.slice("lessons:".length)}` :
            p.startsWith("enrollments:") ? `enrollment:${p.slice("enrollments:".length)}` :
            p
          )
          .filter(Boolean) as LmsPermission[];

        const now = new Date().toISOString();
        return {
          id: String(r.roleId ?? r.id ?? ""),
          name: String(r.displayName ?? r.roleName ?? r.roleId ?? "Role"),
          description: String(r.roleName ?? ""),
          permissions: [...new Set(perms)],
          createdAt: String(r.createdAt ?? now),
          updatedAt: String(r.updatedAt ?? now),
        };
      });
      setRoles(mapped);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const createRole = useCallback(
    async (input: { name: string; description?: string; permissions: LmsPermission[] }) => {
      const roleId = input.name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_").slice(0, 40) || `ROLE_${Date.now()}`;
      const allow = [...new Set(input.permissions)].map((p) =>
        p.startsWith("course:") ? `courses:${p.slice("course:".length)}` :
        p.startsWith("lesson:") ? `lessons:${p.slice("lesson:".length)}` :
        p.startsWith("enrollment:") ? `enrollments:${p.slice("enrollment:".length)}` :
        p
      );
      const { envelope } = await postModule(
        "admin",
        {
          action: "createRole",
          roleId,
          roleName: input.description?.trim() || input.name.trim(),
          displayName: input.name.trim(),
          status: "ACTIVE",
          isSystem: false,
          permissions: { allow, deny: [] },
        } as any,
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
      const created = roles.find((r) => r.id === roleId);
      return (
        created ?? {
          id: roleId,
          name: input.name.trim(),
          description: input.description?.trim(),
          permissions: [...new Set(input.permissions)],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    },
    [accessToken, refresh, roles]
  );

  const updateRole = useCallback(
    async (id: string, patch: Partial<Pick<CustomRole, "name" | "description" | "permissions">>) => {
      const current = roles.find((r) => r.id === id);
      const displayName = patch.name?.trim() ?? current?.name ?? id;
      const roleName = patch.description?.trim() ?? current?.description ?? displayName;
      const perms = patch.permissions ?? current?.permissions ?? [];
      const allow = [...new Set(perms)].map((p) =>
        p.startsWith("course:") ? `courses:${p.slice("course:".length)}` :
        p.startsWith("lesson:") ? `lessons:${p.slice("lesson:".length)}` :
        p.startsWith("enrollment:") ? `enrollments:${p.slice("enrollment:".length)}` :
        p
      );

      const { envelope } = await postModule(
        "admin",
        {
          action: "updateRole",
          roleId: id,
          displayName,
          status: "ACTIVE",
          permissions: { allow, deny: [] },
        } as any,
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, refresh, roles]
  );

  const deleteRole = useCallback(
    async (id: string) => {
      // No deleteRole action in the provided guide.
      // If your backend supports it later, add an action (e.g. "deleteRole") here.
      throw new Error("Backend API does not provide a deleteRole action in the integration guide.");
    },
    []
  );

  const value = useMemo(
    () => ({ roles, loading, error, refresh, createRole, updateRole, deleteRole }),
    [roles, loading, error, refresh, createRole, updateRole, deleteRole]
  );

  return <CustomRolesContext.Provider value={value}>{children}</CustomRolesContext.Provider>;
}

export function useCustomRoles() {
  const ctx = useContext(CustomRolesContext);
  if (!ctx) throw new Error("useCustomRoles must be used within CustomRolesProvider");
  return ctx;
}
