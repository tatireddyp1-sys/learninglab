import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/PageState";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  BookOpen,
  LinkIcon,
  Unlink,
  Trash2,
  Edit2,
  FileText,
  ImageIcon,
  Video,
  FileQuestion,
  FileType,
  Download,
  Loader2,
} from "lucide-react";
import type { Lesson } from "@shared/lms";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";

const BLOCK_ICONS: Record<string, typeof FileText> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  quiz: FileQuestion,
  pdf: FileType,
  download: Download,
};

export default function Lessons() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { courses, lessons, attachLessonToCourse, detachLessonFromCourse, deleteLesson } = useLms();
  const { showLessonBuilderNav } = usePermissions();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "standalone" | "attached">("all");
  const [attachDialogLesson, setAttachDialogLesson] = useState<Lesson | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [detaching, setDetaching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const canManage = showLessonBuilderNav();

  const allLessons = useMemo(() => {
    return lessons.filter((l) => !l.deleted);
  }, [lessons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLessons.filter((l) => {
      const matchesQuery = !q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q);
      if (filter === "standalone") return matchesQuery && !l.courseId;
      if (filter === "attached") return matchesQuery && !!l.courseId;
      return matchesQuery;
    });
  }, [allLessons, query, filter]);

  const standaloneLessons = useMemo(() => filtered.filter((l) => !l.courseId), [filtered]);
  const attachedLessons = useMemo(() => filtered.filter((l) => !!l.courseId), [filtered]);

  const courseMap = useMemo(() => {
    const map = new Map<string, string>();
    excludeDeletedCourses(courses).forEach((c) => map.set(c.id, c.title));
    return map;
  }, [courses]);

  const myCourses = useMemo(() => {
    if (!user) return [];
    const visible = excludeDeletedCourses(courses);
    if (hasRole("admin")) return visible;
    return visible.filter((c) => c.createdBy === user.id);
  }, [user, courses, hasRole]);

  async function handleAttach() {
    if (!attachDialogLesson || !selectedCourseId) return;
    setAttaching(true);
    try {
      await attachLessonToCourse(attachDialogLesson.id, selectedCourseId);
      toast({ title: "Lesson attached to course" });
      setAttachDialogLesson(null);
      setSelectedCourseId("");
    } catch (err: any) {
      toast({ title: "Failed to attach", description: err.message, variant: "destructive" });
    } finally {
      setAttaching(false);
    }
  }

  async function handleDetach(lessonId: string) {
    setDetaching(lessonId);
    try {
      await detachLessonFromCourse(lessonId);
      toast({ title: "Lesson detached from course" });
    } catch (err: any) {
      toast({ title: "Failed to detach", description: err.message, variant: "destructive" });
    } finally {
      setDetaching(null);
    }
  }

  async function handleDelete(lessonId: string) {
    setDeleting(lessonId);
    try {
      await deleteLesson(lessonId);
      toast({ title: "Lesson deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  function getEditPath(lesson: Lesson) {
    if (lesson.courseId) return `/courses/${lesson.courseId}/lessons/${lesson.id}`;
    return `/lessons/${lesson.id}/edit`;
  }

  function LessonCard({ lesson }: { lesson: Lesson }) {
    const courseName = lesson.courseId ? courseMap.get(lesson.courseId) : null;
    const blockCounts = lesson.blocks.reduce<Record<string, number>>((acc, b) => {
      acc[b.type] = (acc[b.type] || 0) + 1;
      return acc;
    }, {});

    return (
      <Card className="hover:shadow-md transition-shadow flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{lesson.title}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {lesson.description || "No description"}
              </CardDescription>
            </div>
            {courseName ? (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {courseName}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-xs border-amber-500/40 text-amber-600">
                Standalone
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col justify-between">
          {lesson.blocks.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(blockCounts).map(([type, count]) => {
                const Icon = BLOCK_ICONS[type] || BookOpen;
                return (
                  <span key={type} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {count} {type}
                  </span>
                );
              })}
            </div>
          )}
          {lesson.blocks.length === 0 && (
            <p className="text-xs text-muted-foreground mb-3">No content blocks yet</p>
          )}

          <div className="flex flex-wrap gap-2 pt-3 border-t">
            {lesson.courseId && lesson.blocks.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/viewer?courseId=${lesson.courseId}&lessonId=${lesson.id}`}>
                  <BookOpen className="h-3 w-3 mr-1" /> View
                </Link>
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to={getEditPath(lesson)}>
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Link>
                </Button>
                {!lesson.courseId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAttachDialogLesson(lesson);
                      setSelectedCourseId("");
                    }}
                  >
                    <LinkIcon className="h-3 w-3 mr-1" /> Attach to course
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={detaching === lesson.id}
                    onClick={() => handleDetach(lesson.id)}
                  >
                    {detaching === lesson.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3 mr-1" />
                    )}
                    Detach
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  disabled={deleting === lesson.id}
                  onClick={() => handleDelete(lesson.id)}
                >
                  {deleting === lesson.id ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Delete
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Lessons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All lessons across your platform. Create standalone lessons and attach them to courses.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link to="/lessons/new">
              <Plus className="h-4 w-4 mr-1" /> Create lesson
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search lessons..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "standalone", "attached"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "standalone" ? "Standalone" : "In courses"}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} lesson{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No lessons found"
          description={query ? "Try a different search term." : "Create your first lesson to get started."}
          action={
            canManage ? (
              <Button asChild>
                <Link to="/lessons/new">
                  <Plus className="h-4 w-4 mr-1" /> Create lesson
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {filter !== "attached" && standaloneLessons.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Standalone lessons
                <Badge variant="outline" className="text-xs">{standaloneLessons.length}</Badge>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {standaloneLessons.map((l) => (
                  <LessonCard key={l.id} lesson={l} />
                ))}
              </div>
            </div>
          )}

          {filter !== "standalone" && attachedLessons.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Course lessons
                <Badge variant="outline" className="text-xs">{attachedLessons.length}</Badge>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {attachedLessons.map((l) => (
                  <LessonCard key={l.id} lesson={l} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attach to course dialog */}
      <Dialog open={!!attachDialogLesson} onOpenChange={(open) => { if (!open) setAttachDialogLesson(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach lesson to course</DialogTitle>
            <DialogDescription>
              Choose a course to attach "{attachDialogLesson?.title}" to. The lesson will appear in the course's lesson list.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a course..." />
            </SelectTrigger>
            <SelectContent>
              {myCourses.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No courses available</div>
              ) : (
                myCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title} ({c.status})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachDialogLesson(null)}>Cancel</Button>
            <Button onClick={handleAttach} disabled={!selectedCourseId || attaching}>
              {attaching && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
