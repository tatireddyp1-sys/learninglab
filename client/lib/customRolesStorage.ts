import type { CustomRole } from "@shared/lms";

const KEY = "lms_custom_roles";

export function loadCustomRoles(): CustomRole[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomRole[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomRoles(roles: CustomRole[]) {
  localStorage.setItem(KEY, JSON.stringify(roles));
}
