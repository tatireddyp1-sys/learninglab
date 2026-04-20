/**
 * Map live LMS module responses (courses / lessons) onto shared `Course` / `Lesson` shapes.
 * Handles alternate field names and enum casing from API Gateway implementations.
 */

import type { Course, Enrollment, Lesson } from "@shared/lms";
import { mapApiBlock } from "@shared/lms";

function parseCourseStatus(raw: unknown): Course["status"] {
  const s = String(raw ?? "draft").toLowerCase();
  if (s === "published" || s === "active") return "published";
  if (s === "archived") return "archived";
  if (s === "deleted") return "deleted";
  return "draft";
}

/** Normalize one course row from listCourses / getCourse / createCourse data. */
export function normalizeApiCourse(c: Record<string, unknown>, fallbackUserId: string, nowIso: string): Course {
  const lessonOrderRaw = c.lessonOrder ?? c.lessonIds ?? (c as { moduleOrder?: unknown }).moduleOrder;
  const lessonOrder = Array.isArray(lessonOrderRaw)
    ? lessonOrderRaw.map((x) => String(x))
    : [];
  const teacherIdsRaw = c.teacherIds;
  const teacherIds = Array.isArray(teacherIdsRaw)
    ? teacherIdsRaw.map((x) => String(x))
    : undefined;

  const createdByNameRaw =
    c.createdByName ??
    (c as { createdByDisplayName?: unknown }).createdByDisplayName ??
    (c as { creatorDisplayName?: unknown }).creatorDisplayName ??
    (c as { creatorName?: unknown }).creatorName ??
    (c as { ownerName?: unknown }).ownerName ??
    (c as { instructorName?: unknown }).instructorName ??
    (c as { displayName?: unknown }).displayName ??
    c.teacherName;
  const deletedFlag = Boolean(c.deleted ?? (c as { isDeleted?: unknown }).isDeleted);
  let status = parseCourseStatus(c.status ?? c.courseStatus);
  if (deletedFlag) status = "deleted";
  return {
    id: String(c.courseId ?? c.id ?? ""),
    title: String(c.title ?? ""),
    description: String(c.description ?? ""),
    status,
    createdBy: String(c.createdBy ?? c.ownerId ?? c.teacherId ?? fallbackUserId),
    createdByName: createdByNameRaw != null && String(createdByNameRaw).trim() !== "" ? String(createdByNameRaw) : undefined,
    teacherIds,
    createdAt: String(c.createdAt ?? nowIso),
    updatedAt: String(c.updatedAt ?? nowIso),
    updatedBy: c.updatedBy != null ? String(c.updatedBy) : undefined,
    lessonOrder,
  };
}

/** Map ENROLLMENTS module row → shared `Enrollment` (API uses UPPERCASE status). */
export function normalizeApiEnrollmentRow(
  e: Record<string, unknown>,
  fallbackUserId: string,
  nowIso: string
): Enrollment {
  const statusUpper = String(e.status ?? "ACTIVE").toUpperCase();
  let status: Enrollment["status"] = "active";
  if (statusUpper === "COMPLETED") status = "completed";
  else if (statusUpper === "DROPPED") status = "dropped";
  else if (statusUpper === "SUSPENDED") status = "suspended";

  const courseId = String(e.courseId ?? "");
  const userId = String(e.userId ?? fallbackUserId);
  return {
    id: String(e.enrollmentId ?? e.id ?? `${courseId}:${userId}`),
    courseId,
    userId,
    userName: e.userName != null ? String(e.userName) : undefined,
    status,
    enrolledAt: String(e.enrolledAt ?? nowIso),
    completedAt: e.completedAt != null ? String(e.completedAt) : undefined,
  };
}

/** Normalize one lesson row from listLessons / getLesson / createLesson. */
export function normalizeApiLesson(l: Record<string, unknown>, fallbackUserId: string, nowIso: string): Lesson {
  const blocksRaw = l.blocks;
  const blocks = Array.isArray(blocksRaw) ? blocksRaw.map((b) => mapApiBlock(b)) : [];
  const statusUpper = String(l.status ?? "").toUpperCase();
  const deleted =
    Boolean(l.deleted ?? l.isDeleted) || statusUpper === "DELETED";

  return {
    id: String(l.lessonId ?? l.id ?? ""),
    courseId: String(l.courseId ?? ""),
    title: String(l.title ?? ""),
    description: String(l.description ?? ""),
    blocks,
    lessonOrder: l.lessonOrder != null && Number.isFinite(Number(l.lessonOrder)) ? Number(l.lessonOrder) : undefined,
    sequential: l.sequential !== false,
    locked: Boolean(l.locked ?? l.isLocked),
    deleted,
    createdBy:
      l.createdBy != null
        ? String(l.createdBy)
        : l.authorId != null
          ? String(l.authorId)
          : l.createdByUserId != null
            ? String(l.createdByUserId)
            : undefined,
    createdAt: String(l.createdAt ?? nowIso),
    updatedAt: String(l.updatedAt ?? nowIso),
    updatedBy: l.updatedBy != null ? String(l.updatedBy) : undefined,
    version: Number(l.version ?? l.currentVersion ?? 1),
  };
}

/** Presigned upload payload variants (getUploadUrl). */
export function normalizeUploadUrlPayload(data: unknown): {
  uploadUrl: string;
  assetUrl: string;
  s3Bucket: string;
  s3Key: string;
} {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    uploadUrl: String(
      d.uploadUrl ?? d.putUrl ?? d.presignedUrl ?? d.signedUrl ?? d.presignedPutUrl ?? d.url ?? ""
    ),
    assetUrl: String(
      d.assetUrl ?? d.publicUrl ?? d.cdnUrl ?? d.fileUrl ?? d.downloadUrl ?? d.assetURL ?? ""
    ),
    s3Bucket: String(d.s3Bucket ?? d.bucket ?? ""),
    s3Key: String(d.s3Key ?? d.key ?? d.storageKey ?? ""),
  };
}

export function courseStatusToApiEnum(status: Course["status"]): string {
  if (status === "published") return "PUBLISHED";
  if (status === "archived") return "ARCHIVED";
  return "DRAFT";
}

/** Accepts createLesson / createStandaloneLesson response shapes from mock or live API. */
export function extractLessonIdFromEnvelope(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  if (o.lessonId != null) return String(o.lessonId);
  if (o.id != null && String(o.id).length > 0) return String(o.id);
  const lesson = o.lesson;
  if (lesson && typeof lesson === "object") {
    const l = lesson as Record<string, unknown>;
    if (l.lessonId != null) return String(l.lessonId);
    if (l.id != null) return String(l.id);
  }
  return "";
}
