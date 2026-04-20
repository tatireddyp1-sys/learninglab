import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { useLms } from "@/context/LmsContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import RoleBadge from "@/components/ui/RoleBadge";
import { Copy, Info } from "lucide-react";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfilePage() {
  const { user, hasRole } = useAuth();
  const { roles } = useCustomRoles();
  const { enrollments, lessons, courses, getCourseProgressPercent, getCompletedLessonIds } = useLms();
  const { toast } = useToast();

  const customName = user?.customRoleId ? roles.find((r) => r.id === user.customRoleId)?.name : undefined;

  const learningStats = useMemo(() => {
    if (!user) return null;
    const mine = enrollments.filter((e) => e.userId === user.id && e.status !== "dropped");
    const active = mine.filter((e) => e.status === "active");
    const completedCourses = mine.filter((e) => e.status === "completed").length;

    let lessonsCompleted = 0;
    let lessonTotal = 0;
    const progressPercents: number[] = [];

    for (const e of mine) {
      const done = getCompletedLessonIds(user.id, e.courseId);
      lessonsCompleted += done.size;
      const courseLessons = lessons.filter((l) => l.courseId === e.courseId && !l.deleted);
      lessonTotal += courseLessons.length;
      progressPercents.push(getCourseProgressPercent(user.id, e.courseId));
    }

    const avgProgress = progressPercents.length
      ? Math.round(progressPercents.reduce((a, b) => a + b, 0) / progressPercents.length)
      : 0;

    return {
      enrollmentCount: mine.length,
      activeCount: active.length,
      completedCourses,
      lessonsCompleted,
      lessonTotal,
      avgProgress,
    };
  }, [user, enrollments, lessons, getCompletedLessonIds, getCourseProgressPercent]);

  const teachingCount = useMemo(() => {
    if (!user) return 0;
    return excludeDeletedCourses(courses).filter((c) => c.createdBy === user.id).length;
  }, [user, courses]);

  async function copyField(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }

  if (!user) return null;

  const sortedAllow = [...user.permissionsAllow].sort((a, b) => a.localeCompare(b));
  const sortedDeny = [...user.permissionsDeny].sort((a, b) => a.localeCompare(b));
  const wildcard = sortedAllow.some((p) => p === "*:*" || p.endsWith(":*"));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and learning activity in this workspace.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Local workspace data</AlertTitle>
        <AlertDescription>
          Your profile and progress are stored in this browser (local storage / IndexedDB). Clearing site data or using
          another device will not show the same information.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
            aria-hidden
          >
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-xl">{user.name}</CardTitle>
            <CardDescription className="break-all">{user.email}</CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Role</span>
              <RoleBadge role={user.role} />
              {customName && (
                <span className="text-xs text-muted-foreground">
                  Custom: <span className="font-medium text-foreground">{customName}</span>
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Account IDs</p>
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm font-mono text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">User ID</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 gap-1 px-2"
                  onClick={() => copyField(user.id, "User ID")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <p className="break-all text-foreground">{user.id}</p>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">Tenant ID</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 gap-1 px-2"
                  onClick={() => copyField(user.tenantId, "Tenant ID")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <p className="break-all text-foreground">{user.tenantId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasRole("teacher") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teaching snapshot</CardTitle>
            <CardDescription>Courses you own in this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Courses created</p>
              <p className="text-2xl font-semibold tabular-nums">{teachingCount}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/courses">Manage courses</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasRole("student") && learningStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learning snapshot</CardTitle>
            <CardDescription>Based on your current enrollments.</CardDescription>
          </CardHeader>
          <CardContent>
            {learningStats.enrollmentCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                You are not enrolled in any courses yet. Your instructor or administrator can add you to a course; then it will show under{" "}
                <Link to="/my-courses" className="text-primary underline underline-offset-4">My courses</Link>.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-3">
                  <dt className="text-muted-foreground">Enrollments</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{learningStats.enrollmentCount}</dd>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <dt className="text-muted-foreground">Courses completed</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{learningStats.completedCourses}</dd>
                </div>
                <div className="rounded-lg border bg-card p-3 col-span-2 sm:col-span-1">
                  <dt className="text-muted-foreground">Lessons completed</dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {learningStats.lessonsCompleted}
                    {learningStats.lessonTotal > 0 && (
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}/ {learningStats.lessonTotal}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="rounded-lg border bg-card p-3 col-span-2 sm:col-span-3">
                  <dt className="text-muted-foreground">Average course progress</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{learningStats.avgProgress}%</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="rounded-lg border px-4">
        <AccordionItem value="perms" className="border-b-0">
          <AccordionTrigger className="text-sm font-medium">Permissions</AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground">
            {wildcard && (
              <p className="text-foreground">
                <span className="font-medium">Wildcard access:</span> your allow list includes broad permissions. The
                UI still hides some actions by role where appropriate.
              </p>
            )}
            <div>
              <p className="font-medium text-foreground mb-1">Allowed</p>
              {sortedAllow.length === 0 ? (
                <p className="italic">None listed</p>
              ) : (
                <ul className="list-inside list-disc space-y-0.5 break-all">
                  {sortedAllow.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Denied</p>
              {sortedDeny.length === 0 ? (
                <p className="italic">None</p>
              ) : (
                <ul className="list-inside list-disc space-y-0.5 break-all">
                  {sortedDeny.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="dev" className="border-b-0">
          <AccordionTrigger className="text-sm font-medium">Security notes</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Prefer httpOnly cookies for session tokens in production deployments, and treat UI permissions as hints
              only — always enforce access on the server.
            </p>
            <p>
              The allow/deny lists above come from your sign-in response. Your organization may compute effective
              permissions server-side and expose a reduced set to the client.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
