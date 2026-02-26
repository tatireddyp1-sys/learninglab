/**
 * Demo Credentials for Testing
 * 
 * These credentials are automatically seeded into localStorage on first app load.
 * They are NOT displayed to users on the UI.
 * 
 * MFA Code (for all accounts): 123456
 */

export const DEMO_CREDENTIALS = {
  admin: {
    email: "admin@demo.com",
    password: "admin123",
    name: "Admin User",
    role: "admin" as const,
    description: "Full access to user management, audit logs, and lesson management",
  },
  teacher: {
    email: "teacher@demo.com",
    password: "teacher123",
    name: "John Teacher",
    role: "teacher" as const,
    description: "Can upload and edit lessons, browse all lessons",
  },
  student: {
    email: "student@demo.com",
    password: "student123",
    name: "Sarah Student",
    role: "student" as const,
    description: "Can browse lessons and track progress (read-only)",
  },
};

export const MFA_CODE = "123456";
