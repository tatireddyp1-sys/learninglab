import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ForbiddenState } from "@/components/PageState";
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
import { useToast } from "@/hooks/use-toast";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";
import { Loader2, LogOut } from "lucide-react";

export default function MyCoursesPage() {
  const { user, hasRole } = useAuth();
  const { enrollments, courses, getCourseProgressPercent, dropEnrollment } = useLms();
  const { toast } = useToast();
  const [leaveCourseId, setLeaveCourseId] = useState<string | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  const visibleCourses = useMemo(() => excludeDeletedCourses(courses), [courses]);
  const teaching = useMemo(() => {
    if (!user) return [];
    return visibleCourses.filter((c) => c.createdBy === user.id);
  }, [user, visibleCourses]);
  const mine = useMemo(() => {
    if (!user) return [];
    return enrollments.filter((e) => e.userId === user.id && e.status !== "dropped");
  }, [user, enrollments]);
  const studentEnrollments = useMemo(() => {
    return mine.filter((e) => visibleCourses.some((c) => c.id === e.courseId));
  }, [mine, visibleCourses]);

  if (!user) return null;

  if (hasRole("admin")) {
    return (
      <ForbiddenState message="My courses is for teachers and students. Use Courses or Enrollments from the dashboard or sidebar." />
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{hasRole("teacher") ? "My teaching" : "My courses"}</h1>
        <p className="text-sm text-muted-foreground">
          {hasRole("teacher")
            ? "Draft and published courses you created."
            : "Courses you are enrolled in."}
        </p>
      </div>

      {hasRole("teacher") && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Teaching</h2>
            <p className="text-sm text-muted-foreground">Drafts and published courses you created.</p>
          </div>
          {teaching.length === 0 ? (
            <EmptyState
              title="No courses yet"
              description="Create a course to start teaching."
              action={
                <Button asChild>
                  <Link to="/courses/new">Create course</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {teaching.map((c) => (
                <li key={c.id}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{c.title}</CardTitle>
                        <Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge>
                      </div>
                      <CardDescription>{c.description?.slice(0, 120)}</CardDescription>
                    </CardHeader>
                    <div className="px-6 pb-6 flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link to={`/courses/${c.id}`}>Open</Link>
                      </Button>
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/courses/${c.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasRole("student") && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Your enrollments</h2>
            <p className="text-sm text-muted-foreground">Progress and quick links.</p>
          </div>
          {studentEnrollments.length === 0 ? (
            <EmptyState
              title="No enrollments yet"
              description="When an instructor or administrator enrolls you in a course, it will appear here."
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {studentEnrollments.map((e) => {
                const c = visibleCourses.find((x) => x.id === e.courseId);
                const pct = getCourseProgressPercent(user.id, e.courseId);
                return (
                  <li key={e.id}>
                    <Card>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{c?.title ?? "Course"}</CardTitle>
                          <Badge>{e.status}</Badge>
                        </div>
                        <CardDescription>{c?.description?.slice(0, 120)}</CardDescription>
                      </CardHeader>
                      <div className="px-6 pb-6 space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" asChild>
                            <Link to={`/courses/${e.courseId}`}>Open course</Link>
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            className="text-destructive border-destructive/30"
                            onClick={() => setLeaveCourseId(e.courseId)}
                          >
                            <LogOut className="h-3.5 w-3.5 mr-1" />
                            Leave
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <AlertDialog open={!!leaveCourseId} onOpenChange={(open) => !open && setLeaveCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this course?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be unenrolled until you join again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={leaveSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (ev) => {
                ev.preventDefault();
                if (!leaveCourseId) return;
                setLeaveSubmitting(true);
                try {
                  await dropEnrollment(leaveCourseId);
                  toast({ title: "You left the course" });
                  setLeaveCourseId(null);
                } catch (err: any) {
                  toast({ title: "Could not leave", description: err.message, variant: "destructive" });
                } finally {
                  setLeaveSubmitting(false);
                }
              }}
            >
              {leaveSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
