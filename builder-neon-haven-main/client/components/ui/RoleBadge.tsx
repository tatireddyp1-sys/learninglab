import { cn } from "@/lib/utils";
import { UserRole } from "@/context/AuthContext";
import { Shield, Users, BookOpen } from "lucide-react";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const roleConfig: Record<UserRole, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  admin: {
    label: "Admin",
    bgColor: "bg-red-500/10",
    textColor: "text-red-600 dark:text-red-400",
    icon: <Shield className="w-3 h-3" />,
  },
  teacher: {
    label: "Teacher",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    icon: <Users className="w-3 h-3" />,
  },
  student: {
    label: "Student",
    bgColor: "bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
    icon: <BookOpen className="w-3 h-3" />,
  },
};

export default function RoleBadge({ role, size = "md", showIcon = true }: RoleBadgeProps) {
  const config = roleConfig[role];

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.bgColor,
        config.textColor,
        sizeClasses[size]
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </div>
  );
}
