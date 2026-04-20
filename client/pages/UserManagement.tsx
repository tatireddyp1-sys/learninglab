import React, { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import RoleBadge from "@/components/ui/RoleBadge";
import CreateUserModal from "@/components/admin/CreateUserModal";
import { AlertCircle, Plus, Save, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "@/context/AuthContext";
import { roleSelectionToApiId, userPrimaryRoleSelection } from "@/lib/userRoles";

const BUILTIN_ROLE_IDS = new Set(["ADMIN", "TEACHER", "STUDENT"]);

type EditState = {
  email: string;
  firstName: string;
  lastName: string;
  /** Built-in `student`|`teacher`|`admin`, or a custom role id (e.g. `CONTENT_REVIEWER`). */
  role: string;
  isActive: boolean;
};

function RoleCell({ u, roleLabelById }: { u: User; roleLabelById: Map<string, string> }) {
  const customId = u.customRoleId?.trim();
  if (customId) {
    const label = roleLabelById.get(customId.toUpperCase()) ?? customId;
    return (
      <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300">
        {label}
      </span>
    );
  }
  return <RoleBadge role={u.role} size="sm" />;
}

export default function UserManagement() {
  const { user, listUsers, createUser, updateUser, replacePrimaryRole, disableUser, enableUser } = useAuth();
  const { roles: customRoles } = useCustomRoles();
  const { can } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, EditState>>({});
  const [roleBeforeEdit, setRoleBeforeEdit] = useState<Record<string, string>>({});

  const roleLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of customRoles) {
      m.set(r.id.toUpperCase(), r.name);
    }
    return m;
  }, [customRoles]);

  const selectableCustomRoles = useMemo(
    () => customRoles.filter((r) => !BUILTIN_ROLE_IDS.has(r.id.toUpperCase())),
    [customRoles]
  );

  React.useEffect(() => {
    (async () => {
      try {
        const rows = await listUsers();
        setUsers(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      }
    })();
  }, [listUsers]);

  if (!can("admin:users", {})) {
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
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [users, searchQuery]);

  const handleCreateUser = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    roleSelection: string
  ) => {
    setIsLoading(true);
    setError("");
    try {
      await createUser({
        email,
        password,
        firstName,
        lastName,
        roleId: roleSelectionToApiId(roleSelection),
      });
      setUsers(await listUsers());
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
      const ed = editingData[userId];
      if (!ed) return;

      const urow = users.find((x) => x.id === userId);
      const previousRole = roleBeforeEdit[userId] ?? (urow ? userPrimaryRoleSelection(urow) : "student");
      if (previousRole !== ed.role) {
        await replacePrimaryRole(userId, previousRole, ed.role);
      }

      await updateUser(userId, {
        email: ed.email,
        status: ed.isActive ? "ACTIVE" : "DISABLED",
        firstName: ed.firstName,
        lastName: ed.lastName,
      });

      setUsers(await listUsers());
      setEditingId(null);
      setEditingData({});
      setRoleBeforeEdit({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    setIsLoading(true);
    setError("");
    try {
      if (u.isActive) await disableUser(u.id);
      else await enableUser(u.id);
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (u: User) => {
    const parts = (u.name || "").trim().split(/\s+/);
    const sel = userPrimaryRoleSelection(u);
    setEditingId(u.id);
    setRoleBeforeEdit((prev) => ({ ...prev, [u.id]: sel }));
    setEditingData({
      ...editingData,
      [u.id]: {
        email: u.email,
        firstName: u.firstName ?? parts[0] ?? "",
        lastName: u.lastName ?? parts.slice(1).join(" ") ?? "",
        role: sel,
        isActive: u.isActive,
      },
    });
  };

  const updateEditingField = (userId: string, field: keyof EditState, value: string | boolean) => {
    setEditingData({
      ...editingData,
      [userId]: { ...editingData[userId], [field]: value },
    });
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-white/60 mt-1">Create, view, edit, and disable users (admin)</p>
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

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-white">Users</CardTitle>
            <CardDescription className="text-white/60">All users in your tenant</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary/30 bg-primary/5">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Role</th>
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
                      <td className="px-6 py-4 text-sm text-white">
                        {editingId === u.id ? (
                          <div className="flex gap-2 max-w-xs">
                            <Input
                              value={editingData[u.id]?.firstName ?? ""}
                              onChange={(e) => updateEditingField(u.id, "firstName", e.target.value)}
                              className="h-8 text-xs"
                              placeholder="First"
                            />
                            <Input
                              value={editingData[u.id]?.lastName ?? ""}
                              onChange={(e) => updateEditingField(u.id, "lastName", e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Last"
                            />
                          </div>
                        ) : (
                          u.name
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/80">
                        {editingId === u.id ? (
                          <Input
                            value={editingData[u.id]?.email ?? ""}
                            onChange={(e) => updateEditingField(u.id, "email", e.target.value)}
                            className="h-8 text-xs max-w-[220px]"
                          />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === u.id ? (
                          <select
                            value={editingData[u.id]?.role ?? userPrimaryRoleSelection(u)}
                            onChange={(e) => updateEditingField(u.id, "role", e.target.value)}
                            className="rounded-md border border-primary/30 bg-card px-2 py-1 text-xs text-white max-w-[220px]"
                          >
                            <optgroup label="Built-in">
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="admin">Admin</option>
                            </optgroup>
                            {selectableCustomRoles.length > 0 ? (
                              <optgroup label="Custom roles">
                                {selectableCustomRoles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                          </select>
                        ) : (
                          <RoleCell u={u} roleLabelById={roleLabelById} />
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
                                setRoleBeforeEdit({});
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
                              onClick={() => startEditing(u)}
                              disabled={isLoading}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(u)}
                              disabled={isLoading || u.id === user?.id}
                            >
                              {u.isActive ? "Disable" : "Enable"}
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

        <div className="text-sm text-white/60">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateUser={handleCreateUser}
        isLoading={isLoading}
      />
    </div>
  );
}
