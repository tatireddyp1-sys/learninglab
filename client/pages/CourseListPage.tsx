import { useMemo, useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { usePermissions } from "@/hooks/usePermissions";
import { ApiLoader } from "@/components/ApiLoader";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/DataTable";
import { DataPaginationBar } from "@/components/DataPaginationBar";
import { EmptyState } from "@/components/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course } from "@shared/lms";
import { useToast } from "@/hooks/use-toast";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";

const PAGE_SIZE = 8;

export default function CourseListPage() {
  const { user, hasRole } = useAuth();
  const { users, loading: usersDirectoryLoading, resolveName } = useUserDirectory();
  const { canCreateCourse, canEditCourse, canDeleteCourse } = usePermissions();
  const { courses, getEnrollment, deleteCourse, refresh, loading, error } = useLms();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [createdBy, setCreatedBy] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [enrollmentFilter, setEnrollmentFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const catalogCourses = useMemo(() => excludeDeletedCourses(courses), [courses]);

  const filtered = useMemo(() => {
    return catalogCourses.filter((c) => {
      const q = debounced.toLowerCase();
      const text = `${c.title} ${c.description}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (createdBy !== "all" && c.createdBy !== createdBy) return false;
      if (status !== "all" && c.status !== status) return false;
      if (hasRole("student") && enrollmentFilter !== "all" && user) {
        const en = getEnrollment(user.id, c.id);
        if (enrollmentFilter === "enrolled" && !en) return false;
        if (enrollmentFilter === "not_enrolled" && en) return false;
      }
      return true;
    });
  }, [catalogCourses, debounced, createdBy, status, enrollmentFilter, getEnrollment, user, hasRole]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [filtered.length, page]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const columns: Column<Course>[] = useMemo(
    () => [
      {
        id: "title",
        header: "Course",
        cell: (c) => (
          <div>
            <div className="font-medium">{c.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{c.description || "—"}</div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (c) => (
          <Badge
            variant={c.status === "published" ? "default" : c.status === "archived" ? "outline" : "secondary"}
          >
            {c.status}
          </Badge>
        ),
      },
      {
        id: "owner",
        header: "Created by",
        cell: (c) => {
          const label = resolveName(c.createdBy, c.createdByName);
          if (label) return <span className="text-sm">{label}</span>;
          if (usersDirectoryLoading) return <Skeleton className="h-4 w-28 inline-block align-middle" />;
          return <span className="text-sm text-muted-foreground">Unknown user</span>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: (c) => {
          const canEdit = user && canEditCourse(c);
          const canDel = user && canDeleteCourse(c);
          return (
            <div className="flex flex-wrap gap-1 justify-end">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/courses/${c.id}`}>View</Link>
              </Button>
              {canEdit && (
                <Button size="sm" variant="secondary" asChild>
                  <Link to={`/courses/${c.id}/edit`}>Edit</Link>
                </Button>
              )}
              {canDel && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (window.confirm("Delete this course?")) {
                      try {
                        await deleteCourse(c.id);
                        toast({ title: "Course deleted" });
                      } catch (err: any) {
                        toast({ title: "Delete failed", description: err.message, variant: "destructive" });
                      }
                    }
                  }}
                >
                  Delete
                </Button>
              )}
              {(user?.role === "teacher" || user?.role === "admin") && canEdit && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/courses/${c.id}/lessons/new`}>Add lesson</Link>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [user, deleteCourse, toast, canEditCourse, canDeleteCourse, resolveName, usersDirectoryLoading]
  );

  if (user && hasRole("student")) {
    return <Navigate to="/my-courses" replace />;
  }

  if (loading && catalogCourses.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and manage the course catalog.</p>
        </div>
        <ApiLoader fullPage label="Loading courses…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => refresh()}>Retry</Button>
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and manage the course catalog.</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && catalogCourses.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Updating…
            </span>
          )}
          {user && canCreateCourse() && (
            <Button asChild>
              <Link to="/courses/new">Create course</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search courses…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={createdBy}
          onValueChange={(v) => {
            setCreatedBy(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Created by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All authors</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {hasRole("student") && (
          <Select
            value={enrollmentFilter}
            onValueChange={(v) => {
              setEnrollmentFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="My enrollment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Enrollment (all)</SelectItem>
              <SelectItem value="enrolled">Enrolled</SelectItem>
              <SelectItem value="not_enrolled">Not enrolled</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create a course to get started, or adjust your filters."
          action={
            user && canCreateCourse() ? (
              <Button asChild>
                <Link to="/courses/new">Create course</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/courses")}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable columns={columns} data={paged} getRowId={(c) => c.id} />
          <DataPaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
