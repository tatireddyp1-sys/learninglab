/**
 * Mock progress module — start, track, complete, summaries.
 *
 * ► Replace with real API calls by removing this file.
 */

import { getItem, setItem, STORAGE_KEYS } from "@/lib/mockStorage";
import type { StoredCompletion, StoredEnrollment, StoredLesson } from "./seedData";
import { resolveUserFromToken } from "./authService";
import type { LearningLabEnvelope } from "@/lib/learningLabApi";

type Result = { status: number; envelope: LearningLabEnvelope<any> };

function ok<T>(data: T): Result {
  return { status: 200, envelope: { success: true, data } };
}
function fail(status: number, msg: string): Result {
  return { status, envelope: { success: false, message: msg } };
}

function completionToContractRow(c: StoredCompletion): Record<string, unknown> {
  return {
    userId: c.userId,
    lessonId: c.lessonId,
    courseId: c.courseId,
    progress: c.progress,
    completed: c.completed,
    lastViewedAt: c.lastActivityAt,
    lastActivityAt: c.lastActivityAt,
    completedAt: c.completedAt ?? null,
  };
}

/** Students may only record progress for courses they are enrolled in (mock storage). */
function assertStudentEnrolled(caller: any, courseId: string): Result | null {
  if (!caller) return fail(401, "Authentication required");
  if (caller.roleId === "ADMIN" || caller.roleId === "TEACHER") return null;
  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  const enrolled = enrollments.some(
    (e) => e.userId === caller.userId && e.courseId === courseId && e.status !== "DROPPED"
  );
  if (enrolled) return null;
  if (caller.resolvedViaJwt) return null;
  return fail(403, "You must be enrolled in this course to update lesson progress");
}

export async function handleProgress(body: any, token: string | null): Promise<Result> {
  const action = body?.action;
  const caller = resolveUserFromToken(token);

  switch (action) {
    case "getStudentProgress":        return getStudentProgress(caller);
    case "getLessonProgress":         return getLessonProgress(body, caller);
    case "startLesson":               return startLesson(body, caller);
    case "trackProgress":             return trackProgress(body, caller);
    case "completeLesson":            return completeLesson(body, caller);
    case "getCourseProgressSummary":  return getCourseProgressSummary(body, caller);
    default:
      return fail(400, `Unknown progress action: ${action}`);
  }
}

/* ------------------------------------------------------------------ */

function getStudentProgress(caller: any): Result {
  if (!caller) return fail(401, "Authentication required");
  const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, []);
  if (caller.roleId === "ADMIN" || caller.roleId === "TEACHER") {
    return ok(completions.map(completionToContractRow));
  }
  const rows = completions.filter((c) => c.userId === caller?.userId);
  return ok({ userId: caller.userId, progress: rows.map(completionToContractRow) });
}

function getLessonProgress(body: any, caller: any): Result {
  const { lessonId, userId: targetUserId } = body ?? {};
  if (!lessonId) return fail(400, "Missing required field: lessonId");
  if (!caller) return fail(401, "Authentication required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lesson = lessons.find((l) => l.lessonId === lessonId && !l.deleted);
  if (!lesson) return fail(404, "Lesson not found");

  const uid =
    targetUserId &&
    targetUserId !== caller.userId &&
    (caller.roleId === "ADMIN" || caller.roleId === "TEACHER")
      ? String(targetUserId)
      : caller.userId;

  const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, []);
  const row = completions.find(
    (c) => c.userId === uid && c.lessonId === lessonId && c.courseId === lesson.courseId
  );

  if (row) return ok(completionToContractRow(row));

  return ok({
    userId: uid,
    lessonId,
    courseId: lesson.courseId,
    progress: 0,
    completed: false,
    lastViewedAt: null,
    lastActivityAt: null,
    completedAt: null,
  });
}

function startLesson(body: any, caller: any): Result {
  const { lessonId, courseId } = body;
  if (!lessonId || !courseId) return fail(400, "lessonId and courseId are required");
  const gate = assertStudentEnrolled(caller, courseId);
  if (gate) return gate;

  const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, []);
  const existing = completions.find(
    (c) => c.userId === caller.userId && c.courseId === courseId && c.lessonId === lessonId
  );

  const now = new Date().toISOString();
  if (!existing) {
    completions.push({
      userId: caller.userId,
      courseId,
      lessonId,
      completed: false,
      progress: 0,
      lastActivityAt: now,
    });
    setItem(STORAGE_KEYS.completions, completions);
  }

  const row = completions.find(
    (c) => c.userId === caller.userId && c.courseId === courseId && c.lessonId === lessonId
  );
  if (!row) return fail(500, "Internal error");
  return ok(completionToContractRow(row));
}

function trackProgress(body: any, caller: any): Result {
  const { lessonId, courseId, progress } = body;
  if (!lessonId || !courseId) return fail(400, "lessonId and courseId are required");
  if (progress === undefined || progress === null) return fail(400, "Missing required field: progress");
  const n = Number(progress);
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    return fail(400, "progress must be integer between 0 and 100");
  }
  const gate = assertStudentEnrolled(caller, courseId);
  if (gate) return gate;

  const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, []);
  const idx = completions.findIndex(
    (c) => c.userId === caller.userId && c.courseId === courseId && c.lessonId === lessonId
  );

  const now = new Date().toISOString();
  if (idx !== -1) {
    completions[idx].progress = Math.min(100, Math.max(0, n));
    completions[idx].lastActivityAt = now;
    if (completions[idx].progress >= 100) {
      completions[idx].completed = true;
      completions[idx].completedAt = completions[idx].completedAt ?? now;
    }
  } else {
    completions.push({
      userId: caller.userId,
      courseId,
      lessonId,
      completed: n >= 100,
      progress: Math.min(100, Math.max(0, n)),
      completedAt: n >= 100 ? now : undefined,
      lastActivityAt: now,
    });
  }

  setItem(STORAGE_KEYS.completions, completions);
  const row = completions.find(
    (c) => c.userId === caller.userId && c.courseId === courseId && c.lessonId === lessonId
  );
  if (!row) return fail(500, "Internal error");
  return ok(completionToContractRow(row));
}

function completeLesson(body: any, caller: any): Result {
  const { lessonId, courseId } = body;
  if (!lessonId || !courseId) return fail(400, "lessonId and courseId are required");
  const gate = assertStudentEnrolled(caller, courseId);
  if (gate) return gate;

  const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, []);
  const now = new Date().toISOString();
  const idx = completions.findIndex(
    (c) => c.userId === caller.userId && c.courseId === courseId && c.lessonId === lessonId
  );

  if (idx !== -1) {
    completions[idx].completed = true;
    completions[idx].progress = 100;
    completions[idx].completedAt = completions[idx].completedAt ?? now;
    completions[idx].lastActivityAt = now;
  } else {
    completions.push({
      userId: caller.userId,
      courseId,
      lessonId,
      completed: true,
      progress: 100,
      completedAt: now,
      lastActivityAt: now,
    });
  }

  setItem(STORAGE_KEYS.completions, completions);

  autoCompleteEnrollment(caller.userId, courseId, completions, now);

  const row = completions.find(
    (c) => c.userId === caller.userId && c.courseId === courseId && c.lessonId === lessonId
  );
  if (!row) return fail(500, "Internal error");
  return ok(completionToContractRow(row));
}

function autoCompleteEnrollment(userId: string, courseId: string, completions: StoredCompletion[], now: string) {
  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, [])
    .filter((l) => l.courseId === courseId && !l.deleted);
  if (lessons.length === 0) return;

  const completedIds = new Set(
    completions
      .filter((c) => c.userId === userId && c.courseId === courseId && c.completed)
      .map((c) => c.lessonId)
  );
  const allDone = lessons.every((l) => completedIds.has(l.lessonId));
  if (!allDone) return;

  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  const eIdx = enrollments.findIndex(
    (e) => e.userId === userId && e.courseId === courseId && e.status === "ACTIVE"
  );
  if (eIdx === -1) return;

  enrollments[eIdx].status = "COMPLETED";
  enrollments[eIdx].completedAt = enrollments[eIdx].completedAt ?? now;
  setItem(STORAGE_KEYS.enrollments, enrollments);
}

function getCourseProgressSummary(body: any, caller: any): Result {
  if (!caller) return fail(401, "Authentication required");
  if (caller.roleId === "STUDENT") {
    return fail(403, "Course analytics are only available to instructors and administrators");
  }
  const { courseId } = body;
  if (!courseId) return fail(400, "courseId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, [])
    .filter((l) => l.courseId === courseId && !l.deleted);
  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, [])
    .filter((e) => e.courseId === courseId && e.status !== "DROPPED");
  const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, [])
    .filter((c) => c.courseId === courseId);

  const totalLessons = lessons.length;
  const enrolledStudents = enrollments.length;

  const studentBreakdown = enrollments.map((e) => {
    const userCompletions = completions.filter((c) => c.userId === e.userId);
    const completed = userCompletions.filter((c) => c.completed).length;
    const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
    return {
      userId: e.userId,
      userName: e.userName,
      lessonsCompleted: completed,
      totalLessons,
      progress,
    };
  });

  const avgProgress = studentBreakdown.length > 0
    ? Math.round(studentBreakdown.reduce((sum, s) => sum + s.progress, 0) / studentBreakdown.length)
    : 0;
  const completionRate = studentBreakdown.length > 0
    ? Math.round((studentBreakdown.filter((s) => s.progress >= 100).length / studentBreakdown.length) * 100)
    : 0;

  return ok({
    courseId,
    totalLessons,
    enrolledStudents,
    averageProgress: avgProgress,
    completionRate,
    studentBreakdown,
  });
}
