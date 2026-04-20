import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import { useLms } from "@/context/LmsContext";
import { userCanManageCourseRoster } from "@/lib/lmsResourceAccess";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/PageState";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Lock,
  Loader2,
  CheckCircle2,
  BookOpen,
  FileText,
  ImageIcon,
  Video,
  FileQuestion,
  FileType,
  Download as DownloadIcon,
  UserPlus,
  UserMinus,
  LogOut,
} from "lucide-react";
import { isLiveLmsHttpEnabled } from "@/lib/learningLabApi";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const { user, hasRole } = useAuth();
  const { roles: customRoles } = useCustomRoles();
  const { canEditCourse, canPublishCourse } = usePermissions();
  const { users: directoryUsers, loading: usersDirectoryLoading } = useUserDirectory();
  const {
    getCourse,
    getLessonsForCourse,
    enrollments,
    getCourseProgressPercent,
    getEnrollment,
    getCompletedLessonIds,
    isLessonLocked,
    publishCourse,
    archiveCourse,
    enroll,
    enrollUserInCourse,
    deleteEnrollment,
    dropEnrollment,
  } = useLms();
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterUserId, setRosterUserId] = useState<string>("");
  const [rosterManualUserId, setRosterManualUserId] = useState("");
  const [rosterSubmitting, setRosterSubmitting] = useState(false);
  const [rosterRemoveUserId, setRosterRemoveUserId] = useState<string | null>(null);
  const [rosterRemoveSubmitting, setRosterRemoveSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  useEffect(() => {
    if (!rosterOpen) {
      setRosterUserId("");
      setRosterManualUserId("");
    }
  }, [rosterOpen]);

  useEffect(() => {
    setRosterUserId("");
    setRosterManualUserId("");
  }, [courseId]);

  const course = courseId ? getCourse(courseId) : undefined;
  const lessons = courseId ? getLessonsForCourse(courseId) : [];
  const count = enrollments.filter((e) => e.courseId === courseId && e.status !== "dropped").length;
  const progress = user && courseId ? getCourseProgressPercent(user.id, courseId) : 0;
  const en = user && courseId ? getEnrollment(user.id, courseId) : undefined;

  const canEdit = user && course && canEditCourse(course);
  const canPublish = user && course && canPublishCourse(course);
  const canManageRoster =
    !!user && !!course && userCanManageCourseRoster(user, customRoles, course);

  const courseRoster = useMemo(() => {
    if (!courseId) return [];
    return enrollments.filter((e) => e.courseId === courseId && e.status !== "dropped");
  }, [courseId, enrollments]);

  const rosterCandidates = useMemo(() => {
    if (!courseId) return [];
    const taken = new Set(
      enrollments.filter((e) => e.courseId === courseId && e.status !== "dropped").map((e) => e.userId)
    );
    return directoryUsers.filter((u) => !taken.has(u.id));
  }, [courseId, directoryUsers, enrollments]);

  const nextLesson = useMemo(() => {
    if (!user || !course) return lessons[0];
    if (!hasRole("student")) return lessons[0];
    for (const l of lessons) {
      if (!isLessonLocked(user.id, course, l)) return l;
    }
    return lessons[0];
  }, [user, course, lessons, isLessonLocked, hasRole]);

  if (!courseId || !course) {
    return (
      <EmptyState title="Course not found" description="This course may have been removed." />
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-2xl">{course.title}</CardTitle>
              <CardDescription className="mt-2 whitespace-pre-wrap">{course.description || "No description"}</CardDescription>
            </div>
            <Badge>{course.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild variant="secondary">
              <Link to={`/courses/${course.id}/edit`}>Edit course</Link>
            </Button>
          )}
          {canPublish && (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch
                id="pub"
                disabled={isPublishing}
                checked={course.status === "published"}
                onCheckedChange={async (v) => {
                  setIsPublishing(true);
                  try {
                    if (v) await publishCourse(course.id);
                    else await archiveCourse(course.id);
                    toast({ title: v ? "Course published" : "Course unpublished" });
                  } catch (err: any) {
                    toast({ title: "Failed", description: err.message, variant: "destructive" });
                  } finally {
                    setIsPublishing(false);
                  }
                }}
              />
              <Label htmlFor="pub" className="flex items-center gap-1.5">
                {isPublishing && <Loader2 className="h-3 w-3 animate-spin" />}
                Published
              </Label>
            </div>
          )}
          {canEdit && (
            <Button asChild>
              <Link to={`/courses/${course.id}/lessons/new`}>Add lesson</Link>
            </Button>
          )}
          {course.status === "published" &&
            user &&
            hasRole("student") &&
            !isLiveLmsHttpEnabled("enrollments") && (
            <Button
              variant="outline"
              disabled={!!en || isEnrolling}
              onClick={async () => {
                setIsEnrolling(true);
                try {
                  const result = await enroll(course.id);
                  toast({ title: result ? "Enrolled successfully" : "Could not enroll" });
                } catch (err: any) {
                  toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
                } finally {
                  setIsEnrolling(false);
                }
              }}
            >
              {isEnrolling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              {en ? "Enrolled" : "Enroll"}
            </Button>
          )}
          {canManageRoster && (
            <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="secondary">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Add learner
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enroll a learner</DialogTitle>
                  <DialogDescription>
                    Add a user to this course roster. You can enroll students or other instructors as learners.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="roster-user">User (directory)</Label>
                    <Select
                      value={rosterUserId || undefined}
                      onValueChange={(v) => {
                        setRosterUserId(v);
                        setRosterManualUserId("");
                      }}
                    >
                      <SelectTrigger id="roster-user">
                        <SelectValue
                          placeholder={
                            usersDirectoryLoading
                              ? "Loading users…"
                              : rosterCandidates.length === 0
                                ? directoryUsers.length === 0
                                  ? "No directory — use ID field"
                                  : "Everyone listed is already enrolled"
                                : "Choose someone to enroll"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {rosterCandidates.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roster-manual">Or user ID</Label>
                    <Input
                      id="roster-manual"
                      value={rosterManualUserId}
                      onChange={(e) => {
                        setRosterManualUserId(e.target.value);
                        setRosterUserId("");
                      }}
                      placeholder="usr_…"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    disabled={
                      rosterSubmitting || !(rosterUserId.trim() || rosterManualUserId.trim())
                    }
                    onClick={async () => {
                      const targetId = rosterUserId.trim() || rosterManualUserId.trim();
                      if (!targetId) return;
                      setRosterSubmitting(true);
                      try {
                        await enrollUserInCourse(course.id, targetId);
                        toast({ title: "Learner enrolled" });
                        setRosterOpen(false);
                        setRosterUserId("");
                        setRosterManualUserId("");
                      } catch (err: any) {
                        toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
                      } finally {
                        setRosterSubmitting(false);
                      }
                    }}
                  >
                    {rosterSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Enroll
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {hasRole("student") && en && nextLesson && (
            <Button asChild>
              <Link to={`/viewer?courseId=${course.id}&lessonId=${nextLesson.id}`}>Start learning</Link>
            </Button>
          )}
          {hasRole("student") && en && en.status !== "dropped" && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive border-destructive/30"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Leave course
            </Button>
          )}
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${hasRole("student") ? "md:grid-cols-2" : ""}`}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{count}</p>
            <p className="text-sm text-muted-foreground">Learners in this course</p>
          </CardContent>
        </Card>
        {hasRole("student") && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Your progress</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
            </CardContent>
          </Card>
        )}
      </div>

      {canManageRoster && courseId && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Course roster</CardTitle>
            <CardDescription>Active learners. Remove drops their enrollment for this course.</CardDescription>
          </CardHeader>
          <CardContent>
            {courseRoster.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active enrollments yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {courseRoster.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="font-medium">{row.userName ?? row.userId}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{row.status}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRosterRemoveUserId(row.userId)}
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Lessons ({lessons.length})</h2>
        {lessons.length === 0 ? (
          <EmptyState
            title="No lessons yet"
            description="Add lessons from the course editor or lesson builder."
            action={
              canEdit ? (
                <Button asChild>
                  <Link to={`/courses/${course.id}/lessons/new`}>Add lesson</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {lessons.map((l, idx) => {
              const locked =
                user && course && hasRole("student") ? isLessonLocked(user.id, course, l) : false;
              const completed =
                user && courseId && hasRole("student")
                  ? getCompletedLessonIds(user.id, courseId).has(l.id)
                  : false;
              const blockCounts = l.blocks.reduce<Record<string, number>>((acc, b) => {
                acc[b.type] = (acc[b.type] || 0) + 1;
                return acc;
              }, {});
              const typeIcons: Record<string, typeof FileText> = {
                text: FileText, image: ImageIcon, video: Video,
                quiz: FileQuestion, pdf: FileType, download: DownloadIcon,
              };

              return (
                <li
                  key={l.id}
                  className={`rounded-lg border p-4 transition-all ${
                    completed
                      ? "border-green-500/30 bg-green-500/5"
                      : locked
                        ? "border-muted/40 opacity-60"
                        : "hover:border-primary/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-normal min-w-[24px]">{idx + 1}.</span>
                        {l.title}
                        {completed && (
                          <Badge variant="default" className="gap-1 bg-green-600 text-white text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </Badge>
                        )}
                        {locked && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      {l.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 ml-7">{l.description}</p>
                      )}
                      {l.blocks.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 ml-7">
                          {Object.entries(blockCounts).map(([type, count]) => {
                            const Icon = typeIcons[type] || BookOpen;
                            return (
                              <span key={type} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Icon className="h-3 w-3" />
                                {count} {type}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      {canEdit && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/courses/${course.id}/lessons/${l.id}`}>Edit</Link>
                        </Button>
                      )}
                      {locked ? (
                        <Button size="sm" variant="outline" disabled>
                          <Lock className="h-3 w-3 mr-1" /> Locked
                        </Button>
                      ) : (
                        <Button size="sm" variant={completed ? "outline" : "default"} asChild>
                          <Link to={`/viewer?courseId=${course.id}&lessonId=${l.id}`}>
                            {hasRole("student") ? (completed ? "Review" : "Open") : "Preview"}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!rosterRemoveUserId} onOpenChange={(open) => !open && setRosterRemoveUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this learner?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this course until enrolled again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rosterRemoveSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rosterRemoveSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (ev) => {
                ev.preventDefault();
                if (!courseId || !rosterRemoveUserId) return;
                setRosterRemoveSubmitting(true);
                try {
                  await deleteEnrollment(courseId, rosterRemoveUserId);
                  toast({ title: "Learner removed from course" });
                  setRosterRemoveUserId(null);
                } catch (err: any) {
                  toast({ title: "Could not remove", description: err.message, variant: "destructive" });
                } finally {
                  setRosterRemoveSubmitting(false);
                }
              }}
            >
              {rosterRemoveSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this course?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be unenrolled and lose access until you enroll again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={leaveSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (ev) => {
                ev.preventDefault();
                if (!courseId) return;
                setLeaveSubmitting(true);
                try {
                  await dropEnrollment(courseId);
                  toast({ title: "You left the course" });
                  setLeaveOpen(false);
                } catch (err: any) {
                  toast({ title: "Could not leave", description: err.message, variant: "destructive" });
                } finally {
                  setLeaveSubmitting(false);
                }
              }}
            >
              {leaveSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {user?.role === "admin" && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Admin</CardTitle>
            <CardDescription>Override controls for platform administrators.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link to={`/courses/${course.id}/edit`}>Edit any field</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/enrollments">View all enrollments</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
