/**
 * Mock courses module — list, create, update, publish, archive, delete.
 *
 * ► Replace with real API calls by removing this file.
 */

import { getItem, setItem, STORAGE_KEYS } from "@/lib/mockStorage";
import type { StoredCourse, StoredAuditEntry } from "./seedData";
import { resolveUserFromToken } from "./authService";
import type { LearningLabEnvelope } from "@/lib/learningLabApi";

type Result = { status: number; envelope: LearningLabEnvelope<any> };

function ok<T>(data: T): Result {
  return { status: 200, envelope: { success: true, data } };
}
function fail(status: number, message: string): Result {
  return { status, envelope: { success: false, message } };
}

function assertStaff(caller: any): Result | null {
  if (!caller) return fail(401, "Authentication required");
  if (caller.roleId !== "ADMIN" && caller.roleId !== "TEACHER") {
    return fail(403, "You do not have permission to modify courses");
  }
  return null;
}

export async function handleCourses(body: any, token: string | null): Promise<Result> {
  const action = body?.action;
  const caller = resolveUserFromToken(token);

  switch (action) {
    case "listCourses":
      return listCourses();
    case "createCourse":
      return createCourse(body, caller);
    case "updateCourse":
      return updateCourse(body, caller);
    case "publishCourse":
      return publishCourse(body.courseId, caller);
    case "archiveCourse":
      return archiveCourse(body.courseId, caller);
    case "deleteCourse":
      return deleteCourse(body.courseId, caller);
    case "assignTeacher":
      return assignTeacher(body, caller);
    case "removeTeacher":
      return removeTeacher(body, caller);
    default:
      return fail(400, `Unknown courses action: ${action}`);
  }
}

/* ------------------------------------------------------------------ */

function listCourses(): Result {
  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const payload = courses.map((c) => ({
    ...c,
    teacherIds: c.teacherIds?.length ? c.teacherIds : [c.createdBy],
  }));
  return ok({ courses: payload });
}

function createCourse(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { title, description = "" } = body;
  if (!title?.trim()) return fail(400, "Course title is required");

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const now = new Date().toISOString();
  const courseId = `crs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const creatorId = caller?.userId ?? "unknown";
  const newCourse: StoredCourse = {
    courseId,
    title: title.trim(),
    description: description.trim(),
    status: "DRAFT",
    createdBy: creatorId,
    createdByName: caller?.name ?? "Unknown",
    teacherIds: [creatorId],
    createdAt: now,
    updatedAt: now,
    updatedBy: caller?.userId ?? "unknown",
    lessonOrder: [],
  };

  courses.push(newCourse);
  setItem(STORAGE_KEYS.courses, courses);
  appendAudit(caller, "COURSE_CREATED", "courses", courseId, `Created course: ${title.trim()}`);

  return ok({ courseId, ...newCourse });
}

function updateCourse(body: any, caller: any): Result {
  const { courseId, title, description, status, lessonOrder } = body;
  if (!courseId) return fail(400, "courseId is required");

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const idx = courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return fail(404, "Course not found");

  if (title !== undefined) courses[idx].title = title.trim();
  if (description !== undefined) courses[idx].description = description.trim();
  if (status !== undefined) courses[idx].status = status;
  if (lessonOrder !== undefined) courses[idx].lessonOrder = lessonOrder;
  courses[idx].updatedAt = new Date().toISOString();
  courses[idx].updatedBy = caller?.userId ?? courses[idx].updatedBy;
  setItem(STORAGE_KEYS.courses, courses);

  return ok({ courseId, updated: true });
}

function publishCourse(courseId: string, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  if (!courseId) return fail(400, "courseId is required");
  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const idx = courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return fail(404, "Course not found");

  courses[idx].status = "PUBLISHED";
  courses[idx].updatedAt = new Date().toISOString();
  courses[idx].updatedBy = caller?.userId ?? courses[idx].updatedBy;
  setItem(STORAGE_KEYS.courses, courses);
  appendAudit(caller, "COURSE_PUBLISHED", "courses", courseId, `Published course: ${courses[idx].title}`);

  return ok({ courseId });
}

function archiveCourse(courseId: string, caller: any): Result {
  if (!courseId) return fail(400, "courseId is required");
  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const idx = courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return fail(404, "Course not found");

  courses[idx].status = "ARCHIVED";
  courses[idx].updatedAt = new Date().toISOString();
  courses[idx].updatedBy = caller?.userId ?? courses[idx].updatedBy;
  setItem(STORAGE_KEYS.courses, courses);
  appendAudit(caller, "COURSE_ARCHIVED", "courses", courseId, `Archived course: ${courses[idx].title}`);

  return ok({ courseId });
}

function assignTeacher(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const courseId = body?.courseId;
  const teacherId = body?.teacherId != null ? String(body.teacherId).trim() : "";
  if (!courseId || !teacherId) return fail(400, "courseId and teacherId are required");

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const idx = courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return fail(404, "Course not found");

  const c = courses[idx];
  const ids = c.teacherIds?.length ? [...c.teacherIds] : [c.createdBy];
  if (ids.includes(teacherId)) return fail(409, "Teacher already assigned");
  ids.push(teacherId);
  courses[idx] = { ...c, teacherIds: ids, updatedAt: new Date().toISOString(), updatedBy: caller?.userId ?? c.updatedBy };
  setItem(STORAGE_KEYS.courses, courses);
  return ok({ courseId, teacherAssigned: true, teacherIds: ids });
}

function removeTeacher(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const courseId = body?.courseId;
  const teacherId = body?.teacherId != null ? String(body.teacherId).trim() : "";
  if (!courseId || !teacherId) return fail(400, "courseId and teacherId are required");

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const idx = courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return fail(404, "Course not found");

  const c = courses[idx];
  let ids = c.teacherIds?.length ? [...c.teacherIds] : [c.createdBy];
  if (!ids.includes(teacherId)) return fail(400, "Teacher is not assigned to this course");
  ids = ids.filter((id) => id !== teacherId);
  if (ids.length === 0) return fail(400, "At least one teacher must remain assigned");
  courses[idx] = { ...c, teacherIds: ids, updatedAt: new Date().toISOString(), updatedBy: caller?.userId ?? c.updatedBy };
  setItem(STORAGE_KEYS.courses, courses);
  return ok({ courseId, teacherRemoved: true, teacherIds: ids });
}

function deleteCourse(courseId: string, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  if (!courseId) return fail(400, "courseId is required");
  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const idx = courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return fail(404, "Course not found");

  const title = courses[idx].title;
  courses[idx] = {
    ...courses[idx],
    status: "DELETED",
    updatedAt: new Date().toISOString(),
    updatedBy: caller?.userId ?? courses[idx].updatedBy,
  };
  setItem(STORAGE_KEYS.courses, courses);
  appendAudit(caller, "COURSE_DELETED", "courses", courseId, `Deleted course: ${title}`);

  return ok({ courseId, deleted: true, status: "DELETED" });
}

/* ── Helpers ───────────────────────────────────────────────────────── */

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
