import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useLms } from "@/context/LmsContext";
import { excludeDeletedCourses } from "@/lib/lmsResourceAccess";
import { EmptyState } from "@/components/PageState";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LessonBuilderHubPage() {
  const { user } = useAuth();
  const { showLessonBuilderNav } = usePermissions();
  const { courses } = useLms();

  const mine = useMemo(() => {
    if (!user) return [];
    return excludeDeletedCourses(courses).filter((c) => c.createdBy === user.id);
  }, [user, courses]);

  if (!user || !showLessonBuilderNav()) {
    return <EmptyState title="Lesson builder" description="Teachers and admins can manage lessons here." />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Lesson builder</h1>
        <p className="text-sm text-muted-foreground">Pick a course to add or edit lessons.</p>
      </div>
      {mine.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create a course first, then add lessons."
          action={
            <Button asChild>
              <Link to="/courses/new">Create course</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {mine.map((c) => (
            <li key={c.id}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <CardDescription>{c.status}</CardDescription>
                  </div>
                  <Button size="sm" asChild>
                    <Link to={`/courses/${c.id}/lessons/new`}>Add lesson</Link>
                  </Button>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
