import type { ElementType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { usePermissions } from "@/hooks/usePermissions";
import RoleBadge from "@/components/ui/RoleBadge";
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: ElementType; roles?: ("admin" | "teacher" | "student")[] };

const adminNavLinks: { to: string; label: string; icon: ElementType }[] = [
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/roles", label: "Roles", icon: Shield },
];

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  /** Full catalog — staff only; students use My Courses */
  { to: "/courses", label: "Courses", icon: Library, roles: ["admin", "teacher"] },
  /** Learner enrollments — not shown to platform admins */
  { to: "/my-courses", label: "My Courses", icon: BookOpen, roles: ["teacher", "student"] },
  { to: "/lessons", label: "Lessons", icon: GraduationCap },
  { to: "/enrollments", label: "Students / Enrollments", icon: Users, roles: ["admin", "teacher"] },
  { to: "/progress", label: "Progress & Analytics", icon: BarChart3 },
];

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { roles: customRoles } = useCustomRoles();
  const { canAccessAdminNav, showEnrollmentsNav, can } = usePermissions();

  const showAdminLink = (to: string) => {
    if (to === "/admin/users") return can("admin:users", {});
    if (to === "/admin/roles") return can("admin:roles", {}) || can("admin:users", {});
    return false;
  };

  const show = (item: NavItem) => {
    if (!item.roles) return true;
    if (!user) return false;
    if (item.to === "/enrollments") return showEnrollmentsNav();
    return item.roles.includes(user.role);
  };

  const customLabel = user?.customRoleId
    ? customRoles.find((c) => c.id === user.customRoleId)?.name
    : undefined;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1">
          <Logo size={32} />
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Learning Lab
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.filter(show).map((item) => {
                const label =
                  item.to === "/my-courses" && user?.role === "teacher" ? "My teaching" : item.label;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.to || pathname.startsWith(item.to + "/")}
                      tooltip={label}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canAccessAdminNav() && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavLinks.filter((item) => showAdminLink(item.to)).map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.to || pathname.startsWith(item.to + "/")}
                        tooltip={item.label}
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/profile")} tooltip="Profile">
              <Link to="/profile">
                <UserCircle />
                <span>Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {user && (
          <div className="px-2 py-2 text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden">
            <div className="font-medium truncate">{user.name}</div>
            <div className="mt-1 space-y-0.5">
              <RoleBadge role={user.role} size="sm" />
              {customLabel && (
                <div className="text-[10px] text-sidebar-foreground/70 truncate" title={customLabel}>
                  {customLabel}
                </div>
              )}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
