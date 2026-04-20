import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { ApiLoader } from "@/components/ApiLoader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  GraduationCap,
  Library,
  LineChart,
  UserPlus,
  Users,
} from "lucide-react";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const { courses, enrollments, loading } = useLms();
  const { canCreateCourse } = usePermissions();
  const { users: directoryUsers, loading: usersDirectoryLoading } = useUserDirectory();

  const visibleCourses = useMemo(() => excludeDeletedCourses(courses), [courses]);

  if (!user) return null;

  const myCoursesCreated = visibleCourses.filter((c) => c.createdBy === user.id).length;
  const myEnrollments = enrollments.filter((e) => e.userId === user.id && e.status !== "dropped");

  if (loading && visibleCourses.length === 0 && enrollments.length === 0) {
    return <ApiLoader fullPage label="Loading dashboard…" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Welcome back, {user.name}. Here is a snapshot of your Learning Lab activity.
              </p>
            </div>
            {loading && (visibleCourses.length > 0 || enrollments.length > 0) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Updating…
              </span>
            )}
          </div>
        </div>
        {hasRole("teacher") && canCreateCourse() && (
          <Button asChild className="shrink-0">
            <Link to="/courses/new">Create course</Link>
          </Button>
        )}
      </div>

      {hasRole("student") && (
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{myEnrollments.length}</div>
              <CardDescription>Active or completed enrollments</CardDescription>
              <Button variant="link" className="px-0 mt-2" asChild>
                <Link to="/my-courses">View my courses</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/progress">Open progress</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {hasRole("teacher") && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Courses created</CardTitle>
              <Library className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{myCoursesCreated}</div>
              <CardDescription>Published and draft courses you own</CardDescription>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <Button variant="link" className="px-0 h-auto" asChild>
                  <Link to="/courses">Courses management</Link>
                </Button>
                {canCreateCourse() && (
                  <Button variant="link" className="px-0 h-auto" asChild>
                    <Link to="/courses/new">Create course</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Students enrolled</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {enrollments.filter((e) => {
                  const c = visibleCourses.find((x) => x.id === e.courseId);
                  return c?.createdBy === user.id;
                }).length}
              </div>
              <CardDescription>Learners across your courses</CardDescription>
              <Button variant="link" className="px-0 mt-2 h-auto" asChild>
                <Link to="/enrollments">View enrollments</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lesson builder</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full sm:w-auto">
                <Link to="/lesson-builder">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Open builder
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {hasRole("admin") && (
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {usersDirectoryLoading ? "—" : directoryUsers.length}
              </div>
              <CardDescription>Registered users in your organization</CardDescription>
              <Button variant="link" className="px-0 mt-2 h-auto" asChild>
                <Link to="/admin/users">User management</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Courses</CardTitle>
              <Library className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{visibleCourses.length}</div>
              <CardDescription>All courses on the platform</CardDescription>
              <Button variant="link" className="px-0 mt-2 h-auto" asChild>
                <Link to="/courses">Courses management</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{enrollments.length}</div>
              <CardDescription>Total enrollment records</CardDescription>
              <Button variant="link" className="px-0 mt-2 h-auto" asChild>
                <Link to="/enrollments">View enrollments</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
