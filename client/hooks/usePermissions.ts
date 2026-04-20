import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import type { Course } from "@shared/lms";
import {
  can,
  canAccessAdminNav,
  canCreateCourse,
  canDeleteCourse,
  canEditCourse,
  canPublishCourse,
  type PermissionContext,
} from "@/lib/permissions";
import type { LmsPermission } from "@shared/lms";

export function usePermissions() {
  const { user } = useAuth();
  const { roles: customRoles } = useCustomRoles();

  return useMemo(
    () => ({
      can: (permission: LmsPermission, ctx?: PermissionContext) =>
        user ? can(user, customRoles, permission, ctx ?? {}) : false,
      canCreateCourse: () => canCreateCourse(user, customRoles),
      canEditCourse: (course?: Course) =>
        user && course ? canEditCourse(user, customRoles, course, user.id) : false,
      canDeleteCourse: (course?: Course) =>
        user && course ? canDeleteCourse(user, customRoles, course, user.id) : false,
      canPublishCourse: (course?: Course) =>
        user && course ? canPublishCourse(user, customRoles, course, user.id) : false,
      canAccessAdminNav: () => canAccessAdminNav(user, customRoles),
      showLessonBuilderNav: () =>
        user
          ? canCreateCourse(user, customRoles) ||
            can(user, customRoles, "lesson:create", {}) ||
            can(user, customRoles, "course:create", {})
          : false,
      showEnrollmentsNav: () => (user ? can(user, customRoles, "enrollment:manage", {}) : false),
      customRoles,
    }),
    [user, customRoles]
  );
}
