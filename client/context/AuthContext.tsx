import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DEMO_CREDENTIALS } from "@/lib/demoCredentials";

export type UserRole = "admin" | "teacher" | "student";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export interface StoredUser extends User {
  password: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetUserId?: string;
  targetUserName?: string;
  details: Record<string, any>;
  timestamp: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  getAllUsers: () => User[];
  createUser: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  getAuditLogs: () => AuditLog[];
  logAction: (action: string, targetUserId?: string, details?: Record<string, any>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    // Initialize demo users if none exist
    const existingUsers = localStorage.getItem("auth_users");
    if (!existingUsers || JSON.parse(existingUsers).length === 0) {
      const demoUsers: StoredUser[] = Object.entries(DEMO_CREDENTIALS).map(([key, cred]) => ({
        id: `${key}-1`,
        email: cred.email,
        password: cred.password,
        name: cred.name,
        role: cred.role,
        isActive: true,
        createdAt: new Date().toISOString(),
      }));
      localStorage.setItem("auth_users", JSON.stringify(demoUsers));
    }

    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored user:", err);
        localStorage.removeItem("auth_user");
      }
    }
    setIsLoading(false);
  }, []);

  const signup = async (email: string, password: string, name: string) => {
    // Check if user already exists
    const users = JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[];
    if (users.some((u: any) => u.email === email)) {
      throw new Error("User with this email already exists");
    }

    // Create new user (defaults to student role)
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      role: "student",
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // Store user credentials
    users.push({ ...newUser, password });
    localStorage.setItem("auth_users", JSON.stringify(users));

    // Set current user
    setUser(newUser);
    localStorage.setItem("auth_user", JSON.stringify(newUser));
  };

  const login = async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[];
    const foundUser = users.find((u: any) => u.email === email && u.password === password);

    if (!foundUser) {
      throw new Error("Invalid email or password");
    }

    if (!foundUser.isActive) {
      throw new Error("This account has been disabled");
    }

    // Create user object
    const userData: User = {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role,
      isActive: foundUser.isActive,
      createdAt: foundUser.createdAt,
    };

    setUser(userData);
    localStorage.setItem("auth_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("auth_user");
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const logAction = (action: string, targetUserId?: string, details: Record<string, any> = {}) => {
    if (!user) return;

    const logs = JSON.parse(localStorage.getItem("audit_logs") || "[]") as AuditLog[];
    const targetUser = targetUserId
      ? (JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[]).find(
          (u) => u.id === targetUserId
        )
      : undefined;

    const auditLog: AuditLog = {
      id: Date.now().toString(),
      adminId: user.id,
      adminName: user.name,
      action,
      targetUserId,
      targetUserName: targetUser?.name,
      details,
      timestamp: new Date().toISOString(),
    };

    logs.push(auditLog);
    localStorage.setItem("audit_logs", JSON.stringify(logs));
  };

  const getAuditLogs = (): AuditLog[] => {
    try {
      const logs = JSON.parse(localStorage.getItem("audit_logs") || "[]") as AuditLog[];
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return [];
    }
  };

  const getAllUsers = (): User[] => {
    const users = JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[];
    return users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
  };

  const createUser = async (email: string, password: string, name: string, role: UserRole) => {
    if (!hasRole("admin")) {
      throw new Error("Only admins can create users");
    }

    const users = JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[];
    if (users.some((u: any) => u.email === email)) {
      throw new Error("User with this email already exists");
    }

    const newUser: StoredUser = {
      id: Date.now().toString(),
      email,
      name,
      role,
      isActive: true,
      password,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem("auth_users", JSON.stringify(users));

    // Log the creation
    logAction("create_user", newUser.id, { email, name, role });
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    if (!hasRole("admin")) {
      throw new Error("Only admins can update users");
    }

    const users = JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[];
    const userIndex = users.findIndex((u: any) => u.id === userId);

    if (userIndex === -1) {
      throw new Error("User not found");
    }

    users[userIndex] = { ...users[userIndex], ...updates };
    localStorage.setItem("auth_users", JSON.stringify(users));

    // If updating current user, update localStorage
    if (user?.id === userId) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem("auth_user", JSON.stringify(updatedUser));
    }

    // Log the update
    logAction("update_user", userId, updates);
  };

  const deleteUser = async (userId: string) => {
    if (!hasRole("admin")) {
      throw new Error("Only admins can delete users");
    }

    const users = JSON.parse(localStorage.getItem("auth_users") || "[]") as StoredUser[];
    const userToDelete = users.find((u: any) => u.id === userId);
    const filteredUsers = users.filter((u: any) => u.id !== userId);
    localStorage.setItem("auth_users", JSON.stringify(filteredUsers));

    // Log the deletion
    logAction("delete_user", userId, { userName: userToDelete?.name });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signup,
        login,
        logout,
        hasRole,
        getAllUsers,
        createUser,
        updateUser,
        deleteUser,
        getAuditLogs,
        logAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
