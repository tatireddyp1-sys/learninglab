/**
 * Mock enrollments module — list, enroll, remove, status changes.
 *
 * ► Replace with real API calls by removing this file.
 */

import { getItem, setItem, STORAGE_KEYS } from "@/lib/mockStorage";
import type { StoredEnrollment, StoredAuditEntry, StoredCourse, StoredUser } from "./seedData";
import { resolveUserFromToken } from "./authService";
import type { LearningLabEnvelope } from "@/lib/learningLabApi";

type Result = { status: number; envelope: LearningLabEnvelope<any> };

function ok<T>(data: T): Result {
  return { status: 200, envelope: { success: true, data } };
}
function fail(status: number, msg: string): Result {
  return { status, envelope: { success: false, message: msg } };
}

export async function handleEnrollments(body: any, token: string | null): Promise<Result> {
  const action = body?.action;
  const caller = resolveUserFromToken(token);

  switch (action) {
    case "listStudentEnrollments": return listEnrollments(caller);
    case "enrollStudent":         return enrollStudent(body, caller);
    case "removeEnrollment":
    case "deleteEnrollment":      return removeEnrollment(body, caller);
    case "updateEnrollmentStatus": return updateStatus(body, caller);
    default:
      return fail(400, `Unknown enrollments action: ${action}`);
  }
}

/* ------------------------------------------------------------------ */

function listEnrollments(caller: any): Result {
  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  if (caller?.roleId === "ADMIN" || caller?.roleId === "TEACHER") {
    return ok(enrollments);
  }
  return ok(enrollments.filter((e) => e.userId === caller?.userId));
}

function hasEnrollmentManagePermission(caller: StoredUser): boolean {
  const allow = caller.permissionsAllow ?? [];
  if (allow.length > 0) {
    return allow.some((p) => p === "enrollments:manage" || p === "enrollment:manage");
  }
  return caller.roleId === "ADMIN" || caller.roleId === "TEACHER";
}

function callerCanManageCourseEnrollments(caller: StoredUser, course: StoredCourse): boolean {
  if (caller.roleId === "ADMIN") return true;
  if (caller.roleId !== "TEACHER") return false;
  if (!hasEnrollmentManagePermission(caller)) return false;
  return course.createdBy === caller.userId;
}

function canSelfEnrollInPublishedCourse(caller: StoredUser): boolean {
  const allow = caller.permissionsAllow ?? [];
  if (allow.length > 0) {
    return allow.some((p) => p === "courses:enroll" || p === "course:enroll");
  }
  return caller.roleId === "STUDENT" || caller.roleId === "TEACHER" || caller.roleId === "ADMIN";
}

function enrollStudent(body: any, caller: StoredUser | null): Result {
  const { courseId, userId: bodyUserId } = body;
  if (!courseId) return fail(400, "courseId is required");
  if (!caller) return fail(401, "Authentication required");

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const course = courses.find((c) => c.courseId === courseId);
  if (!course) return fail(404, "Course not found");

  const targetUserId =
    bodyUserId != null && String(bodyUserId).trim() !== "" ? String(bodyUserId).trim() : caller.userId;
  const enrollingOthers = targetUserId !== caller.userId;

  if (enrollingOthers) {
    if (!callerCanManageCourseEnrollments(caller, course)) {
      return fail(403, "You can only enroll learners in courses you manage");
    }
  } else {
    if (course.status !== "PUBLISHED") {
      return fail(400, "Course is not open for enrollment");
    }
    if (!canSelfEnrollInPublishedCourse(caller)) {
      return fail(403, "You do not have permission to enroll in courses");
    }
  }

  const users = getItem<StoredUser[]>(STORAGE_KEYS.users, []);
  const target = users.find((u) => u.userId === targetUserId);
  if (!target) return fail(404, "User not found");
  if (target.status === "DISABLED") return fail(400, "User is not active");

  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  const existing = enrollments.find(
    (e) => e.courseId === courseId && e.userId === targetUserId && e.status !== "DROPPED"
  );
  if (existing) return fail(409, "Already enrolled in this course");

  const now = new Date().toISOString();
  const enrollmentId = `enr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const row: StoredEnrollment = {
    enrollmentId,
    courseId,
    userId: target.userId,
    userName: target.name,
    status: "ACTIVE",
    enrolledAt: now,
  };

  enrollments.push(row);
  setItem(STORAGE_KEYS.enrollments, enrollments);
  const auditWho = enrollingOthers ? caller : target;
  appendAudit(
    auditWho,
    "ENROLLMENT_CREATED",
    "enrollments",
    enrollmentId,
    enrollingOthers
      ? `Enrolled ${target.name} in course ${courseId}`
      : `Enrolled in course ${courseId}`
  );

  return ok({ enrollmentId, userId: target.userId, userName: target.name });
}

function removeEnrollment(body: any, caller: StoredUser | null): Result {
  const { courseId, userId } = body;
  if (!courseId || !userId) return fail(400, "courseId and userId are required");
  if (!caller) return fail(401, "Authentication required");

  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  const idx = enrollments.findIndex(
    (e) => e.courseId === courseId && e.userId === userId && e.status !== "DROPPED"
  );
  if (idx === -1) return fail(404, "Enrollment not found");

  if (userId !== caller.userId) {
    const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
    const course = courses.find((c) => c.courseId === courseId);
    if (!course) return fail(404, "Course not found");
    if (!callerCanManageCourseEnrollments(caller, course)) {
      return fail(403, "You do not have permission to remove this enrollment");
    }
  }

  enrollments[idx].status = "DROPPED";
  setItem(STORAGE_KEYS.enrollments, enrollments);
  appendAudit(caller, "ENROLLMENT_REMOVED", "enrollments", enrollments[idx].enrollmentId, `Dropped enrollment for course ${courseId}`);

  return ok({ deleted: true });
}

function updateStatus(body: any, caller: StoredUser | null): Result {
  const { courseId, userId, status } = body;
  if (!courseId || !userId || !status) return fail(400, "courseId, userId, and status are required");
  if (!caller) return fail(401, "Authentication required");

  if (userId !== caller.userId) {
    const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
    const course = courses.find((c) => c.courseId === courseId);
    if (!course) return fail(404, "Course not found");
    if (!callerCanManageCourseEnrollments(caller, course)) {
      return fail(403, "You do not have permission to update this enrollment");
    }
  }

  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  const idx = enrollments.findIndex((e) => e.courseId === courseId && e.userId === userId);
  if (idx === -1) return fail(404, "Enrollment not found");

  const normalizedStatus = status.toUpperCase() as StoredEnrollment["status"];
  enrollments[idx].status = normalizedStatus;
  if (normalizedStatus === "COMPLETED") {
    enrollments[idx].completedAt = new Date().toISOString();
  }
  setItem(STORAGE_KEYS.enrollments, enrollments);

  return ok({ updated: true });
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function appendAudit(caller: any, action: string, module: string, resourceId?: string, details = "") {
  const audit = getItem<StoredAuditEntry[]>(STORAGE_KEYS.audit, []);
  audit.push({
    id: `aud_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    userId: caller?.userId ?? "system",
    userName: caller?.name ?? "System",
    action,
    module,
    resourceId,
    details,
    ipAddress: "127.0.0.1",
  });
  setItem(STORAGE_KEYS.audit, audit);
}
