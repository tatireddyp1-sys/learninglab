import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CustomRole, LmsPermission } from "@shared/lms";
import { loadCustomRoles, saveCustomRoles } from "@/lib/customRolesStorage";

function uid() {
  return `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

interface CustomRolesContextValue {
  roles: CustomRole[];
  createRole: (input: { name: string; description?: string; permissions: LmsPermission[] }) => CustomRole;
  updateRole: (id: string, patch: Partial<Pick<CustomRole, "name" | "description" | "permissions">>) => void;
  deleteRole: (id: string) => void;
}

const CustomRolesContext = createContext<CustomRolesContextValue | undefined>(undefined);

export function CustomRolesProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<CustomRole[]>(() => loadCustomRoles());

  const persist = useCallback((next: CustomRole[]) => {
    saveCustomRoles(next);
    setRoles(next);
  }, []);

  const createRole = useCallback(
    (input: { name: string; description?: string; permissions: LmsPermission[] }) => {
      const now = new Date().toISOString();
      const row: CustomRole = {
        id: uid(),
        name: input.name.trim(),
        description: input.description?.trim(),
        permissions: [...new Set(input.permissions)],
        createdAt: now,
        updatedAt: now,
      };
      persist([...roles, row]);
      return row;
    },
    [persist, roles]
  );

  const updateRole = useCallback(
    (id: string, patch: Partial<Pick<CustomRole, "name" | "description" | "permissions">>) => {
      const now = new Date().toISOString();
      const next = roles.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              permissions: patch.permissions ? [...new Set(patch.permissions)] : r.permissions,
              updatedAt: now,
            }
          : r
      );
      persist(next);
    },
    [persist, roles]
  );

  const deleteRole = useCallback(
    (id: string) => {
      persist(roles.filter((r) => r.id !== id));
    },
    [persist, roles]
  );

  const value = useMemo(
    () => ({ roles, createRole, updateRole, deleteRole }),
    [roles, createRole, updateRole, deleteRole]
  );

  return <CustomRolesContext.Provider value={value}>{children}</CustomRolesContext.Provider>;
}

export function useCustomRoles() {
  const ctx = useContext(CustomRolesContext);
  if (!ctx) throw new Error("useCustomRoles must be used within CustomRolesProvider");
  return ctx;
}
