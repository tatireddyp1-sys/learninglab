import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLms } from "@/context/LmsContext";
import { EmptyState } from "@/components/PageState";
import { ApiLoader } from "@/components/ApiLoader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LessonVersionSnapshot } from "@shared/lms";

export default function LessonHistoryPage() {
  const { courseId, lessonId } = useParams();
  const { getLesson, getCourse, fetchLessonHistory } = useLms();
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  const course = courseId ? getCourse(courseId) : undefined;

  const [history, setHistory] = useState<LessonVersionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    fetchLessonHistory(lessonId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [lessonId, fetchLessonHistory]);

  if (!lesson || !course) {
    return <EmptyState title="Lesson unavailable" description="This lesson may have been removed." />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Version history</h1>
        <p className="text-sm text-muted-foreground">
          {lesson.title} · {course.title}
        </p>
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline inline-block mt-2"
          to={`/courses/${course.id}/lessons/${lesson.id}`}
        >
          Back to editor
        </Link>
      </div>
      {loading ? (
        <ApiLoader label="Loading history…" />
      ) : history.length === 0 ? (
        <EmptyState title="No history yet" description="History is recorded when you save the lesson." />
      ) : (
        <ul className="space-y-3">
          {history.map((h, i) => (
            <li key={`${h.savedAt}-${h.version}-${i}`}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Version {h.version}</CardTitle>
                    <Badge variant="outline">{new Date(h.savedAt).toLocaleString()}</Badge>
                  </div>
                  <CardDescription>Saved by {h.savedBy}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {h.lesson?.blocks?.length ?? 0} blocks · {h.lesson?.title ?? lesson.title}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
