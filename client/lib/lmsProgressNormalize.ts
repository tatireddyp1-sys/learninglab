import type { LessonCompletion } from "@shared/lms";

/**
 * Maps a PROGRESS module row (startLesson / trackProgress / completeLesson / getLessonProgress / getStudentProgress)
 * to `LessonCompletion`. Returns null when the API indicates no stored row yet (§7.4 empty state).
 */
export function mapApiProgressRowToLessonCompletion(row: unknown, fallbackUserId: string): LessonCompletion | null {
  if (row == null || typeof row !== "object") return null;
  const p = row as Record<string, unknown>;

  const lessonId = p.lessonId != null ? String(p.lessonId) : "";
  if (!lessonId) return null;

  const noStoredActivity =
    p.completed !== true &&
    (p.progress == null || Number(p.progress) === 0) &&
    p.lastViewedAt == null &&
    p.lastActivityAt == null &&
    p.completedAt == null;

  if (noStoredActivity) return null;

  const courseId = p.courseId != null ? String(p.courseId) : "";
  const userId = p.userId != null ? String(p.userId) : fallbackUserId;
  const progRaw = p.progress;
  const prog = typeof progRaw === "number" ? progRaw : Number(progRaw);
  const progressPercent = Number.isFinite(prog) ? Math.min(100, Math.max(0, Math.round(prog))) : undefined;
  const completed = Boolean(p.completed === true || (progressPercent !== undefined && progressPercent >= 100));

  const lastView = p.lastViewedAt ?? p.lastActivityAt ?? p.updatedAt;
  const lastActivityAt =
    lastView != null && String(lastView).length > 0
      ? String(lastView)
      : new Date().toISOString();

  return {
    userId,
    courseId,
    lessonId,
    completed,
    completedAt: p.completedAt != null ? String(p.completedAt) : undefined,
    lastActivityAt,
    progressPercent,
  };
}
