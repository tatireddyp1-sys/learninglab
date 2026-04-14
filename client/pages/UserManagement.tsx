import React, { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import RoleBadge from "@/components/ui/RoleBadge";
import CreateUserModal from "@/components/admin/CreateUserModal";
import { AlertCircle, Plus, Trash2, Save, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { UserRole } from "@/context/AuthContext";

export default function UserManagement() {
  const { user, getAllUsers, createUser, updateUser, deleteUser } = useAuth();
  const { roles: customRoles } = useCustomRoles();
  const { canAccessAdminNav } = usePermissions();
  const [users, setUsers] = useState(getAllUsers());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, any>>({});

  if (!canAccessAdminNav()) {
    return (
      <div className="container py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You don't have permission to access this page. Admin access required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
    });
  }, [users, searchQuery]);

  const handleCreateUser = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    customRoleId?: string | null
  ) => {
    setIsLoading(true);
    setError("");
    try {
      await createUser(email, password, name, role, customRoleId);
      setUsers(getAllUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    setIsLoading(true);
    setError("");
    try {
      await updateUser(userId, editingData[userId]);
      setUsers(getAllUsers());
      setEditingId(null);
      setEditingData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    setIsLoading(true);
    setError("");
    try {
      await deleteUser(userId);
      setUsers(getAllUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (userId: string, currentData: any) => {
    setEditingId(userId);
    setEditingData({ ...editingData, [userId]: { ...currentData } });
  };

  const updateEditingField = (userId: string, field: string, value: any) => {
    setEditingData({
      ...editingData,
      [userId]: { ...editingData[userId], [field]: value },
    });
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-white/60 mt-1">Manage users, roles, and permissions</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="w-full md:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search Bar */}
        <Card>
          <CardHeader className="pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-white/40 h-4 w-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary/30 bg-primary/5">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Role / profile</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-white/60">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-white">{u.name}</td>
                      <td className="px-6 py-4 text-sm text-white/80">{u.email}</td>
                      <td className="px-6 py-4 space-y-2">
                        {editingId === u.id ? (
                          <>
                            <select
                              value={editingData[u.id]?.role ?? u.role}
                              onChange={(e) => updateEditingField(u.id, "role", e.target.value as UserRole)}
                              className="rounded-md border border-primary/30 bg-card px-2 py-1 text-xs text-white w-full max-w-[140px]"
                            >
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="admin">Admin</option>
                            </select>
                            <select
                              value={(editingData[u.id]?.customRoleId ?? u.customRoleId) || ""}
                              onChange={(e) =>
                                updateEditingField(u.id, "customRoleId", e.target.value ? e.target.value : null)
                              }
                              className="rounded-md border border-primary/30 bg-card px-2 py-1 text-xs text-white w-full max-w-[200px]"
                            >
                              <option value="">Built-in preset only</option>
                              {customRoles.map((cr) => (
                                <option key={cr.id} value={cr.id}>
                                  {cr.name}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <div>
                            <RoleBadge role={u.role} size="sm" />
                            {u.customRoleId && (
                              <div className="text-[10px] text-white/50 mt-1 max-w-[180px] truncate">
                                {customRoles.find((c) => c.id === u.customRoleId)?.name ?? u.customRoleId}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === u.id ? (
                          <select
                            value={editingData[u.id]?.isActive ? "active" : "disabled"}
                            onChange={(e) => updateEditingField(u.id, "isActive", e.target.value === "active")}
                            className="rounded-md border border-primary/30 bg-card px-2 py-1 text-xs text-white"
                          >
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              u.isActive ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {u.isActive ? "Active" : "Disabled"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {editingId === u.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateUser(u.id)}
                              disabled={isLoading}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditingData({});
                              }}
                              disabled={isLoading}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(u.id, u)}
                              disabled={isLoading}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteUser(u.id)}
                              disabled={isLoading}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* User Count */}
        <div className="text-sm text-white/60">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateUser={handleCreateUser}
        customRoles={customRoles}
        isLoading={isLoading}
      />
    </div>
  );
}
