import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { usePermissions } from "@/hooks/usePermissions";
import { useLms } from "@/context/LmsContext";
import { excludeDeletedCourses, userCanManageCourseRoster } from "@/lib/lmsResourceAccess";
import { DataTable, type Column } from "@/components/DataTable";
import { DataPaginationBar } from "@/components/DataPaginationBar";
import { EmptyState } from "@/components/PageState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Enrollment } from "@shared/lms";
import { isCourseManager } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ApiLoader } from "@/components/ApiLoader";

const PAGE = 10;

export default function EnrollmentListPage() {
  const { user } = useAuth();
  const { users: directoryUsers, loading: usersDirectoryLoading } = useUserDirectory();
  const { roles: customRoles } = useCustomRoles();
  const { showEnrollmentsNav, can } = usePermissions();
  const { enrollments, courses, getCourseProgressPercent, enrollUserInCourse, deleteEnrollment, loading } = useLms();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 250);
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [addCourseId, setAddCourseId] = useState<string>("");
  const [addUserId, setAddUserId] = useState<string>("");
  const [addManualUserId, setAddManualUserId] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Enrollment | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  const visibleCourses = useMemo(() => excludeDeletedCourses(courses), [courses]);

  const rows = useMemo(() => {
    let list = enrollments;
    if (user && !can("course:edit_any", {}) && !can("progress:view_all", {})) {
      const ids = new Set(visibleCourses.filter((c) => isCourseManager(c, user.id)).map((c) => c.id));
      list = list.filter((e) => ids.has(e.courseId));
    }
    return list.filter((e) => {
      const course = courses.find((c) => c.id === e.courseId);
      const hay = `${e.userName ?? ""} ${course?.title ?? ""}`.toLowerCase();
      if (debounced && !hay.includes(debounced.toLowerCase())) return false;
      if (status !== "all" && e.status !== status) return false;
      return true;
    });
  }, [enrollments, courses, visibleCourses, debounced, status, user, can]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE;
    return rows.slice(start, start + PAGE);
  }, [rows, page]);

  const manageableCourses = useMemo(() => {
    if (!user) return [];
    if (can("course:edit_any", {})) return visibleCourses;
    return visibleCourses.filter((c) => isCourseManager(c, user.id));
  }, [user, visibleCourses, can]);

  const addCandidates = useMemo(() => {
    if (!addCourseId) return [];
    const taken = new Set(
      enrollments.filter((e) => e.courseId === addCourseId && e.status !== "dropped").map((e) => e.userId)
    );
    return directoryUsers.filter((u) => !taken.has(u.id));
  }, [addCourseId, directoryUsers, enrollments]);

  const columns: Column<Enrollment>[] = useMemo(
    () => [
      {
        id: "student",
        header: "Learner",
        cell: (e) => e.userName ?? e.userId,
      },
      {
        id: "course",
        header: "Course",
        cell: (e) => courses.find((c) => c.id === e.courseId)?.title ?? e.courseId,
      },
      {
        id: "status",
        header: "Status",
        cell: (e) => <Badge variant="outline">{e.status}</Badge>,
      },
      {
        id: "pct",
        header: "Completion",
        cell: (e) => {
          const p = getCourseProgressPercent(e.userId, e.courseId);
          return `${p}%`;
        },
      },
      {
        id: "last",
        header: "Last activity",
        cell: (e) => (e.completedAt ? new Date(e.completedAt).toLocaleDateString() : "—"),
      },
      {
        id: "actions",
        header: "",
        cell: (e) => {
          const c = courses.find((x) => x.id === e.courseId);
          if (!user || !c || e.status === "dropped") return null;
          if (!userCanManageCourseRoster(user, customRoles, c)) return null;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setRemoveTarget(e)}
            >
              <UserMinus className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          );
        },
      },
    ],
    [courses, getCourseProgressPercent, user, customRoles]
  );

  if (!showEnrollmentsNav()) {
    return <EmptyState title="Restricted" description="You need enrollment management permission to view this page." />;
  }

  if (loading && enrollments.length === 0 && visibleCourses.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Students / Enrollments</h1>
          <p className="text-sm text-muted-foreground">Roster and completion overview.</p>
        </div>
        <ApiLoader fullPage label="Loading enrollments…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Students / Enrollments</h1>
          <p className="text-sm text-muted-foreground">Roster and completion overview.</p>
        </div>
        {loading && (enrollments.length > 0 || visibleCourses.length > 0) && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Updating…
          </span>
        )}
      </div>
      {manageableCourses.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-medium">Enroll someone</h2>
            <p className="text-xs text-muted-foreground">Pick a course you manage and add a learner (including another teacher).</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs">Course</Label>
              <Select value={addCourseId || undefined}
                onValueChange={(v) => {
                  setAddCourseId(v);
                  setAddUserId("");
                  setAddManualUserId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {manageableCourses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[200px] flex-1">
              <Label className="text-xs">User (directory)</Label>
              <Select
                value={addUserId || undefined}
                onValueChange={(v) => {
                  setAddUserId(v);
                  setAddManualUserId("");
                }}
                disabled={!addCourseId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !addCourseId
                        ? "Select a course first"
                        : usersDirectoryLoading
                          ? "Loading users…"
                          : addCandidates.length === 0
                            ? directoryUsers.length === 0
                              ? "No directory — use ID field"
                              : "No users left in list"
                            : "Select user"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {addCandidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[200px] flex-1 w-full md:max-w-xs">
              <Label className="text-xs">Or user ID</Label>
              <Input
                value={addManualUserId}
                onChange={(e) => {
                  setAddManualUserId(e.target.value);
                  setAddUserId("");
                }}
                placeholder="usr_…"
                disabled={!addCourseId}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              disabled={
                !addCourseId ||
                addSubmitting ||
                !(addUserId.trim() || addManualUserId.trim())
              }
              onClick={async () => {
                const targetId = addUserId.trim() || addManualUserId.trim();
                if (!addCourseId || !targetId) return;
                setAddSubmitting(true);
                try {
                  await enrollUserInCourse(addCourseId, targetId);
                  toast({ title: "Learner enrolled" });
                  setAddUserId("");
                  setAddManualUserId("");
                } catch (err: any) {
                  toast({ title: "Could not enroll", description: err.message, variant: "destructive" });
                } finally {
                  setAddSubmitting(false);
                }
              }}
            >
              {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add enrollment
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="dropped">Dropped</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No enrollments" description="When learners enroll, they appear here." />
      ) : (
        <>
          <DataTable columns={columns} data={paged} getRowId={(e) => e.id} />
          <DataPaginationBar page={page} pageSize={PAGE} total={rows.length} onPageChange={setPage} />
        </>
      )}
      {can("admin:users", {}) && (
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline-offset-4 hover:underline" to="/admin/users">
            Manage users
          </Link>
        </p>
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `This will drop ${removeTarget.userName ?? removeTarget.userId} from “${
                    courses.find((c) => c.id === removeTarget.courseId)?.title ?? "this course"
                  }”.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (ev) => {
                ev.preventDefault();
                if (!removeTarget) return;
                setRemoveSubmitting(true);
                try {
                  await deleteEnrollment(removeTarget.courseId, removeTarget.userId);
                  toast({ title: "Enrollment removed" });
                  setRemoveTarget(null);
                } catch (err: any) {
                  toast({ title: "Could not remove", description: err.message, variant: "destructive" });
                } finally {
                  setRemoveSubmitting(false);
                }
              }}
            >
              {removeSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
