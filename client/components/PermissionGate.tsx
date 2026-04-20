import type { ReactNode } from "react";
import type { LmsPermission } from "@shared/lms";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionContext } from "@/lib/permissions";

interface PermissionGateProps {
  permission: LmsPermission;
  context?: PermissionContext;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only when the current user has the permission (including custom roles).
 */
export function PermissionGate({ permission, context = {}, fallback = null, children }: PermissionGateProps) {
  const { can } = usePermissions();
  if (can(permission, context)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
