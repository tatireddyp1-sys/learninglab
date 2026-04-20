import { useState } from "react";
import { Link } from "react-router-dom";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ForbiddenState } from "@/components/PageState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getRolePermissions,
  ALL_LMS_PERMISSIONS,
  getPermissionEditorGroups,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import type { LmsPermission } from "@shared/lms";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { CustomRole } from "@shared/lms";

const BUILTIN = ["admin", "teacher", "student"] as const;

export default function RolesPage() {
  const { can } = usePermissions();
  const { roles, createRole, updateRole, deleteRole } = useCustomRoles();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<LmsPermission>>(new Set());

  if (!can("admin:roles", {}) && !can("admin:users", {})) {
    return <ForbiddenState message="You need the admin:roles or admin:users permission to manage roles." />;
  }

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSelectedPerms(new Set());
    setEditorOpen(true);
  };

  const openEdit = (r: CustomRole) => {
    setEditing(r);
    setName(r.name);
    setDescription(r.description ?? "");
    setSelectedPerms(new Set(r.permissions));
    setEditorOpen(true);
  };

  const togglePerm = (p: LmsPermission) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const selectAll = () => setSelectedPerms(new Set(ALL_LMS_PERMISSIONS));
  const clearAll = () => setSelectedPerms(new Set());

  const selectGroup = (perms: LmsPermission[]) => {
    setSelectedPerms((prev) => new Set([...prev, ...perms]));
  };

  const clearGroup = (perms: LmsPermission[]) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => next.delete(p));
      return next;
    });
  };

  const permissionGroups = getPermissionEditorGroups();

  const saveRole = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const perms = Array.from(selectedPerms);
    if (perms.length === 0) {
      toast({ title: "Pick at least one permission", variant: "destructive" });
      return;
    }
    if (editing) {
      try {
        await updateRole(editing.id, { name: trimmed, description: description.trim(), permissions: perms });
        toast({ title: "Role updated" });
        setEditorOpen(false);
      } catch (err: any) {
        toast({ title: err?.message ?? "Failed to update role", variant: "destructive" });
      }
    } else {
      try {
        await createRole({ name: trimmed, description: description.trim(), permissions: perms });
        toast({ title: "Role created" });
        setEditorOpen(false);
      } catch (err: any) {
        toast({ title: err?.message ?? "Failed to create role", variant: "destructive" });
      }
    }
  };

  const onDelete = async (r: CustomRole) => {
    if (!window.confirm(`Delete role "${r.name}"? Users assigned to it will fall back to their built-in role preset.`)) {
      return;
    }
    try {
      await deleteRole(r.id);
      toast({ title: "Role deleted" });
    } catch (err: any) {
      toast({
        title: err?.message ?? "Delete not supported by backend",
        description: "The provided API guide does not define a deleteRole action.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Roles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          Built-in presets are fixed. Create custom roles with any combination of permissions, then assign them in{" "}
          <Link className="text-primary underline-offset-4 hover:underline" to="/admin/users">
            User management
          </Link>
          .
        </p>
      </div>

      <Tabs defaultValue="custom">
        <TabsList>
          <TabsTrigger value="builtin">Built-in matrix</TabsTrigger>
          <TabsTrigger value="custom">Custom roles</TabsTrigger>
        </TabsList>

        <TabsContent value="builtin" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default presets</CardTitle>
              <CardDescription>Reference matrix for admin, teacher, and student (used when no custom role is assigned).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Permission</TableHead>
                    {BUILTIN.map((r) => (
                      <TableHead key={r} className="text-center capitalize">
                        {r}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_LMS_PERMISSIONS.map((p) => (
                    <TableRow key={p}>
                      <TableCell className="font-mono text-xs">{p}</TableCell>
                      {BUILTIN.map((r) => {
                        const set = getRolePermissions(r);
                        return (
                          <TableCell key={r} className="text-center">
                            {set.has(p) ? "Yes" : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New custom role
            </Button>
          </div>

          {roles.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No custom roles yet. Create one and assign it to users.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {roles.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div>
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}
                        {r.description ? ` · ${r.description}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button type="button" variant="outline" size="icon" onClick={() => openEdit(r)} aria-label="Edit role">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-destructive"
                        onClick={() => onDelete(r)}
                        aria-label="Delete role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs font-mono text-muted-foreground break-all line-clamp-2">
                      {r.permissions.join(", ")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Button variant="outline" asChild>
        <Link to="/admin/users">Assign roles to users</Link>
      </Button>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-2xl">
          <DialogHeader className="px-6 pt-6 pb-2 space-y-1.5">
            <DialogTitle>{editing ? "Edit custom role" : "New custom role"}</DialogTitle>
            <DialogDescription>
              Permissions are grouped by area. Users with this profile use only what you enable here (not the built-in
              teacher/admin/student presets).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Course moderator" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description (optional)</Label>
              <Textarea
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What this role is for"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedPerms.size} of {ALL_LMS_PERMISSIONS.length} selected
              </span>
            </div>
            <Separator />
            <ScrollArea className="h-[min(52vh,440px)] rounded-lg border bg-muted/20">
              <div className="p-4 space-y-6">
                {permissionGroups.map((group, gi) => (
                  <section key={group.id} className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-sm font-semibold leading-none">{group.title}</h3>
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => selectGroup(group.permissions)}
                        >
                          Section: all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => clearGroup(group.permissions)}
                        >
                          none
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.permissions.map((p) => (
                        <label
                          key={p}
                          className="flex gap-3 rounded-md border border-border/80 bg-card/50 px-3 py-2.5 text-left cursor-pointer hover:bg-card transition-colors"
                        >
                          <Checkbox
                            checked={selectedPerms.has(p)}
                            onCheckedChange={() => togglePerm(p)}
                            className="mt-0.5"
                            aria-labelledby={`perm-${p}`}
                          />
                          <span id={`perm-${p}`} className="min-w-0 space-y-0.5">
                            <span className="block text-sm font-medium leading-snug">{PERMISSION_LABELS[p]}</span>
                            <span className="block font-mono text-[11px] text-muted-foreground leading-tight">{p}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {gi < permissionGroups.length - 1 ? <Separator className="!mt-6" /> : null}
                  </section>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/10 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveRole}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
