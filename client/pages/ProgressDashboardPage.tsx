import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/DataTable";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/PageState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

export default function ProgressDashboardPage() {
  const { user, hasRole } = useAuth();
  const { courses, enrollments, lessons, completions, getCourseProgressPercent, getLessonsForCourse } = useLms();

  const visibleCourses = useMemo(() => excludeDeletedCourses(courses), [courses]);

  /* ── Student data ──────────────────────────────────────────────── */
  const studentRows = useMemo(() => {
    if (!user) return [];
    return enrollments
      .filter((e) => e.userId === user.id && e.status !== "dropped")
      .flatMap((e) => {
        const c = visibleCourses.find((x) => x.id === e.courseId);
        if (!c) return [];
        const total = getLessonsForCourse(e.courseId).length;
        const done = completions.filter((x) => x.userId === user.id && x.courseId === e.courseId && x.completed).length;
        return [
          {
            id: e.id,
            courseId: e.courseId,
            course: c.title,
            pct: getCourseProgressPercent(user.id, e.courseId),
            total,
            done,
            remaining: Math.max(0, total - done),
          },
        ];
      });
  }, [user, enrollments, visibleCourses, completions, getCourseProgressPercent, getLessonsForCourse]);

  /* ── Teacher data ──────────────────────────────────────────────── */
  const teacherGrid = useMemo(() => {
    if (!user) return [];
    return enrollments
      .filter((e) => {
        const c = visibleCourses.find((x) => x.id === e.courseId);
        return c?.createdBy === user.id;
      })
      .map((e) => ({
        id: e.id,
        student: e.userName ?? e.userId,
        courseId: e.courseId,
        course: visibleCourses.find((c) => c.id === e.courseId)?.title ?? "",
        pct: getCourseProgressPercent(e.userId, e.courseId),
        last: e.completedAt ?? e.enrolledAt,
      }));
  }, [user, enrollments, visibleCourses, getCourseProgressPercent]);

  /* ── Admin analytics ───────────────────────────────────────────── */
  const courseBarData = useMemo(() => {
    return visibleCourses.map((c) => {
      const enrolled = enrollments.filter((e) => e.courseId === c.id && e.status !== "dropped").length;
      const lessonCount = getLessonsForCourse(c.id).length;
      const courseCompletions = completions.filter((p) => p.courseId === c.id && p.completed).length;
      return {
        name: c.title.length > 20 ? c.title.slice(0, 20) + "…" : c.title,
        enrolled,
        lessons: lessonCount,
        completions: courseCompletions,
      };
    });
  }, [visibleCourses, enrollments, completions, getLessonsForCourse]);

  const statusPieData = useMemo(() => {
    const active = enrollments.filter((e) => e.status === "active").length;
    const completed = enrollments.filter((e) => e.status === "completed").length;
    const dropped = enrollments.filter((e) => e.status === "dropped").length;
    return [
      { name: "Active", value: active },
      { name: "Completed", value: completed },
      { name: "Dropped", value: dropped },
    ].filter((d) => d.value > 0);
  }, [enrollments]);

  const avgCompletion = useMemo(() => {
    if (enrollments.length === 0) return 0;
    const percentages = enrollments
      .filter((e) => e.status !== "dropped")
      .map((e) => getCourseProgressPercent(e.userId, e.courseId));
    if (percentages.length === 0) return 0;
    return Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
  }, [enrollments, getCourseProgressPercent]);

  /* ── Column defs ───────────────────────────────────────────────── */
  const colsStudent: Column<(typeof studentRows)[0]>[] = [
    { id: "c", header: "Course", cell: (r) => <Link to={`/courses/${r.courseId}`} className="text-primary hover:underline">{r.course}</Link> },
    { id: "p", header: "Progress", cell: (r) => (
      <div className="flex items-center gap-3 min-w-[140px]">
        <Progress value={r.pct} className="h-2 flex-1" />
        <span className="text-xs font-medium w-10 text-right">{r.pct}%</span>
      </div>
    )},
    { id: "d", header: "Completed", cell: (r) => `${r.done} / ${r.total}` },
    { id: "r", header: "Remaining", cell: (r) => r.remaining },
  ];

  const colsTeacher: Column<(typeof teacherGrid)[0]>[] = [
    { id: "s", header: "Student", cell: (r) => <span className="font-medium">{r.student}</span> },
    { id: "c", header: "Course", cell: (r) => <Link to={`/courses/${r.courseId}`} className="text-primary hover:underline">{r.course}</Link> },
    { id: "p", header: "Completion", cell: (r) => (
      <div className="flex items-center gap-3 min-w-[140px]">
        <Progress value={r.pct} className="h-2 flex-1" />
        <span className="text-xs font-medium w-10 text-right">{r.pct}%</span>
      </div>
    )},
    { id: "l", header: "Last activity", cell: (r) => (r.last ? new Date(r.last).toLocaleDateString() : "—") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Progress & Analytics</h1>
        <p className="text-sm text-muted-foreground">Completion rates, activity snapshots, and platform-wide insights.</p>
      </div>

      <Tabs defaultValue={hasRole("student") ? "student" : hasRole("teacher") ? "teacher" : "admin"}>
        <TabsList>
          {hasRole("student") && <TabsTrigger value="student">My Progress</TabsTrigger>}
          {(hasRole("teacher") || hasRole("admin")) && <TabsTrigger value="teacher">Student Grid</TabsTrigger>}
          {hasRole("admin") && <TabsTrigger value="admin">Platform Analytics</TabsTrigger>}
        </TabsList>

        {/* ── Student tab ──────────────────────────────────────────── */}
        {hasRole("student") && (
          <TabsContent value="student" className="space-y-6">
            {studentRows.length === 0 ? (
              <EmptyState title="No progress yet" description="Enroll in a course to track progress." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  {studentRows.map((r) => (
                    <Card key={r.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{r.course}</CardTitle>
                        <CardDescription>{r.done} / {r.total} lessons</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Progress value={r.pct} className="h-3" />
                        <div className="flex justify-between mt-2">
                          <p className="text-xs text-muted-foreground">{r.remaining} remaining</p>
                          <span className="text-sm font-semibold">{r.pct}%</span>
                        </div>
                        <Link className="text-sm text-primary mt-3 inline-block hover:underline" to={`/courses/${r.courseId}`}>Continue →</Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <DataTable columns={colsStudent} data={studentRows} getRowId={(r) => r.id} />
              </>
            )}
          </TabsContent>
        )}

        {/* ── Teacher tab ──────────────────────────────────────────── */}
        {(hasRole("teacher") || hasRole("admin")) && (
          <TabsContent value="teacher" className="space-y-6">
            {teacherGrid.length === 0 ? (
              <EmptyState title="No student data" description="Students will appear when they enroll in your courses." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Students Enrolled</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">{teacherGrid.length}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Avg Completion</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">
                      {teacherGrid.length > 0 ? Math.round(teacherGrid.reduce((s, r) => s + r.pct, 0) / teacherGrid.length) : 0}%
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Fully Completed</CardTitle></CardHeader>
                    <CardContent className="text-3xl font-bold">
                      {teacherGrid.filter((r) => r.pct >= 100).length}
                    </CardContent>
                  </Card>
                </div>
                <DataTable columns={colsTeacher} data={teacherGrid} getRowId={(r) => r.id} />
              </>
            )}
          </TabsContent>
        )}

        {/* ── Admin tab ────────────────────────────────────────────── */}
        {hasRole("admin") && (
          <TabsContent value="admin" className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Total Courses</CardTitle></CardHeader>
                <CardContent className="text-3xl font-bold">{visibleCourses.length}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Total Enrollments</CardTitle></CardHeader>
                <CardContent className="text-3xl font-bold">{enrollments.length}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Total Lessons</CardTitle></CardHeader>
                <CardContent className="text-3xl font-bold">{lessons.filter((l) => !l.deleted).length}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Avg Completion</CardTitle></CardHeader>
                <CardContent className="text-3xl font-bold">{avgCompletion}%</CardContent>
              </Card>
            </div>

            {/* Bar chart — enrollments & completions per course */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course Enrollment & Completion</CardTitle>
                <CardDescription>Students enrolled and lessons completed per course</CardDescription>
              </CardHeader>
              <CardContent>
                {courseBarData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No course data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={courseBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend />
                      <Bar dataKey="enrolled" fill="#6366f1" name="Enrolled" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completions" fill="#22c55e" name="Lesson Completions" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pie chart — enrollment status distribution */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Enrollment Status</CardTitle>
                  <CardDescription>Distribution of enrollment statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusPieData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No enrollment data.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {statusPieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Course Breakdown</CardTitle>
                  <CardDescription>Lessons per course</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {visibleCourses.map((c, i) => {
                      const lessonCount = getLessonsForCourse(c.id).length;
                      const enrolled = enrollments.filter((e) => e.courseId === c.id && e.status !== "dropped").length;
                      return (
                        <div key={c.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate max-w-[200px]">{c.title}</span>
                            <span className="text-muted-foreground text-xs">{enrolled} students · {lessonCount} lessons</span>
                          </div>
                          <Progress value={lessonCount > 0 ? Math.min(100, enrolled * 20) : 0} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
