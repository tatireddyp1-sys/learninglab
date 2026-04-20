/**
 * Mock lessons module — CRUD, blocks, reorder, upload URLs, history.
 *
 * ► Replace with real API calls by removing this file.
 */

import { getItem, setItem, STORAGE_KEYS } from "@/lib/mockStorage";
import type { StoredLesson, StoredBlock, StoredCourse, StoredVersionSnapshot, StoredAuditEntry, StoredEnrollment, StoredCompletion } from "./seedData";
import { resolveUserFromToken } from "./authService";
import type { LearningLabEnvelope } from "@/lib/learningLabApi";

type Result = { status: number; envelope: LearningLabEnvelope<any> };

function ok<T>(data: T): Result {
  return { status: 200, envelope: { success: true, data } };
}
function fail(status: number, msg: string): Result {
  return { status, envelope: { success: false, message: msg } };
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function isStaff(caller: any): boolean {
  return caller?.roleId === "ADMIN" || caller?.roleId === "TEACHER";
}

/** Reject non–staff users for lesson authoring and admin actions. */
function assertStaff(caller: any): Result | null {
  if (!caller) return fail(401, "Authentication required");
  if (!isStaff(caller)) return fail(403, "You do not have permission to perform this action");
  return null;
}

function studentEnrolledCourseIds(userId: string): Set<string> {
  const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
  return new Set(
    enrollments.filter((e) => e.userId === userId && e.status !== "DROPPED").map((e) => e.courseId)
  );
}

export async function handleLessons(body: any, token: string | null): Promise<Result> {
  const action = body?.action;
  const caller = resolveUserFromToken(token);

  switch (action) {
    case "listLessons":       return listLessons(body, caller);
    case "listAllLessons":    return listAllLessons(caller);
    case "getLesson":         return getLesson(body, caller);
    case "createLesson":      return createLesson(body, caller);
    case "updateLesson":      return updateLesson(body, caller);
    case "deleteLesson":      return deleteLesson(body, caller);
    case "publishLesson":     return publishLesson(body, caller);
    case "archiveLesson":     return archiveLesson(body, caller);
    case "attachLessonToCourse":  return attachLessonToCourse(body, caller);
    case "detachLessonFromCourse": return detachLessonFromCourse(body, caller);
    case "addBlock":          return addBlock(body, caller);
    case "updateBlock":       return updateBlock(body, caller);
    case "removeBlock":       return removeBlock(body, caller);
    case "reorderBlocks":     return reorderBlocks(body, caller);
    case "getUploadUrl":      return mockUploadUrl(body, caller);
    case "getLessonHistory":  return getLessonHistory(body, caller);
    case "submitQuiz":        return submitQuiz(body, caller);
    default:
      return fail(400, `Unknown lessons action: ${action}`);
  }
}

/* ── List / CRUD ──────────────────────────────────────────────────── */

function listLessons(body: any, caller: any): Result {
  if (!caller) return fail(401, "Authentication required");
  const { courseId, includeDeleted, type: typeRaw, status: statusRaw } = body;
  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const type =
    typeRaw ??
    (courseId ? "course" : undefined) ??
    "all";

  let filtered: StoredLesson[];
  if (type === "course" || (!typeRaw && courseId)) {
    const cid = courseId ?? body.courseId;
    if (!cid) return fail(400, "courseId is required when type is course");
    filtered = lessons.filter((l) => l.courseId === cid);
  } else if (type === "standalone") {
    filtered = lessons.filter((l) => !l.courseId);
  } else {
    filtered = lessons;
    if (caller.roleId === "STUDENT") {
      const allowed = studentEnrolledCourseIds(caller.userId);
      filtered = filtered.filter((l) => l.courseId && allowed.has(l.courseId));
    }
  }

  if (statusRaw) {
    const st = String(statusRaw).toUpperCase();
    if (st === "DELETED") filtered = filtered.filter((l) => l.deleted);
    else filtered = filtered.filter((l) => !l.deleted);
  } else if (!includeDeleted) {
    filtered = filtered.filter((l) => !l.deleted);
  }

  // Lambda contract: success data is a plain array.
  return ok(filtered);
}

function listAllLessons(caller: any): Result {
  if (!caller) return fail(401, "Authentication required");
  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  let list = lessons.filter((l) => !l.deleted);
  if (caller.roleId === "STUDENT") {
    const allowed = studentEnrolledCourseIds(caller.userId);
    list = list.filter((l) => l.courseId && allowed.has(l.courseId));
  }
  return ok({ lessons: list });
}

function getLesson(body: any, caller: any): Result {
  if (!caller) return fail(401, "Authentication required");
  const { lessonId } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lesson = lessons.find((l) => l.lessonId === lessonId);
  if (!lesson) return fail(404, "Lesson not found");

  if (caller.roleId === "STUDENT") {
    if (lesson.courseId) {
      const allowed = studentEnrolledCourseIds(caller.userId);
      if (!allowed.has(lesson.courseId)) return fail(403, "Forbidden: insufficient permissions");
    } else {
      return fail(403, "Forbidden: insufficient permissions");
    }
  }

  return ok({ ...lesson, lessonId: lesson.lessonId, status: "DRAFT" });
}

function createLesson(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { courseId = "", title, description = "", sequential = true } = body;
  if (!title?.trim()) return fail(400, "title is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const now = new Date().toISOString();
  const lessonId = `les_${uid()}`;

  if (courseId) {
    const loRaw = body.lessonOrder;
    if (!Number.isFinite(Number(loRaw)) || Number(loRaw) < 1) {
      return fail(400, "lessonOrder is required and must be a positive integer when courseId is provided");
    }
    const pos = Number(loRaw);
    const coursesEarly = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
    const cIdxEarly = coursesEarly.findIndex((c) => c.courseId === courseId);
    if (cIdxEarly !== -1) {
      const arr = coursesEarly[cIdxEarly].lessonOrder;
      if (pos > arr.length + 1) {
        return fail(400, "lessonOrder out of range for course");
      }
    }
  }

  const newLesson: StoredLesson = {
    lessonId,
    courseId,
    title: title.trim(),
    description: description.trim(),
    blocks: [],
    sequential,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: caller?.userId ?? "unknown",
    version: 1,
  };

  lessons.push(newLesson);
  setItem(STORAGE_KEYS.lessons, lessons);

  if (courseId) {
    const pos = Number(body.lessonOrder);
    const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
    const cIdx = courses.findIndex((c) => c.courseId === courseId);
    if (cIdx !== -1) {
      const arr = courses[cIdx].lessonOrder;
      arr.splice(pos - 1, 0, lessonId);
      courses[cIdx].updatedAt = now;
      setItem(STORAGE_KEYS.courses, courses);
    }
  }

  saveVersionSnapshot(lessonId, newLesson, caller);
  appendAudit(caller, "LESSON_CREATED", "lessons", lessonId, `Created lesson: ${title.trim()}`);

  return ok({ lessonId, ...newLesson });
}

function updateLesson(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, title, description, sequential, baselineUpdatedAt } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const idx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (idx === -1) return fail(404, "Lesson not found");

  if (baselineUpdatedAt && lessons[idx].updatedAt !== baselineUpdatedAt) {
    return fail(409, "Lesson was modified by another user. Refresh and retry.");
  }

  if (title !== undefined) lessons[idx].title = title.trim();
  if (description !== undefined) lessons[idx].description = description.trim();
  if (sequential !== undefined) lessons[idx].sequential = sequential;
  lessons[idx].updatedAt = new Date().toISOString();
  lessons[idx].updatedBy = caller?.userId ?? lessons[idx].updatedBy;
  lessons[idx].version += 1;
  setItem(STORAGE_KEYS.lessons, lessons);

  saveVersionSnapshot(lessonId, lessons[idx], caller);

  return ok({ lessonId, updated: true });
}

function deleteLesson(body: any, caller: any): Result {
  const { lessonId, baselineUpdatedAt } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const idx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (idx === -1) return fail(404, "Lesson not found");

  if (baselineUpdatedAt && lessons[idx].updatedAt !== baselineUpdatedAt) {
    return fail(409, "Lesson was modified by another user. Refresh and retry.");
  }

  const title = lessons[idx].title;
  const courseId = lessons[idx].courseId;
  lessons[idx].deleted = true;
  setItem(STORAGE_KEYS.lessons, lessons);

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const cIdx = courses.findIndex((c) => c.courseId === courseId);
  if (cIdx !== -1) {
    courses[cIdx].lessonOrder = courses[cIdx].lessonOrder.filter((id) => id !== lessonId);
    setItem(STORAGE_KEYS.courses, courses);
  }

  appendAudit(caller, "LESSON_DELETED", "lessons", lessonId, `Deleted lesson: ${title}`);

  return ok({ lessonId, removed: true });
}

function publishLesson(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, baselineUpdatedAt } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const idx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (idx === -1) return fail(404, "Lesson not found");
  if (baselineUpdatedAt && lessons[idx].updatedAt !== baselineUpdatedAt) {
    return fail(409, "Lesson was modified by another user. Refresh and retry.");
  }

  return ok({ lessonId, status: "PUBLISHED", currentVersion: lessons[idx].version });
}

function archiveLesson(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, baselineUpdatedAt } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const idx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (idx === -1) return fail(404, "Lesson not found");
  if (baselineUpdatedAt && lessons[idx].updatedAt !== baselineUpdatedAt) {
    return fail(409, "Lesson was modified by another user. Refresh and retry.");
  }

  return ok({ lessonId, status: "ARCHIVED" });
}

/* ── Attach / Detach ─────────────────────────────────────────────── */

function attachLessonToCourse(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, courseId, lessonOrder: orderRaw } = body;
  if (!lessonId || !courseId) return fail(400, "lessonId and courseId are required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lIdx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (lIdx === -1) return fail(404, "Lesson not found");

  if (lessons[lIdx].courseId && lessons[lIdx].courseId !== courseId) {
    return fail(409, "Lesson is already attached to another course. Detach it first.");
  }

  const now = new Date().toISOString();
  lessons[lIdx].courseId = courseId;
  lessons[lIdx].updatedAt = now;
  lessons[lIdx].updatedBy = caller?.userId ?? "unknown";
  setItem(STORAGE_KEYS.lessons, lessons);

  const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
  const cIdx = courses.findIndex((c) => c.courseId === courseId);
  if (cIdx === -1) return fail(404, "Course not found");

  const arr = courses[cIdx].lessonOrder;
  const without = arr.filter((id) => id !== lessonId);

  if (orderRaw !== undefined && orderRaw !== null) {
    const pos = Number(orderRaw);
    if (!Number.isFinite(pos) || pos < 1 || pos > without.length + 1) {
      return fail(400, "lessonOrder must be a valid insert position for the course");
    }
    without.splice(pos - 1, 0, lessonId);
  } else {
    without.push(lessonId);
  }
  courses[cIdx].lessonOrder = without;
  courses[cIdx].updatedAt = now;
  setItem(STORAGE_KEYS.courses, courses);

  appendAudit(caller, "LESSON_ATTACHED", "lessons", lessonId, `Attached to course ${courseId}`);
  return ok({ lessonId, courseId, attached: true });
}

function detachLessonFromCourse(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lIdx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (lIdx === -1) return fail(404, "Lesson not found");

  const oldCourseId = lessons[lIdx].courseId;
  const now = new Date().toISOString();
  lessons[lIdx].courseId = "";
  lessons[lIdx].updatedAt = now;
  lessons[lIdx].updatedBy = caller?.userId ?? "unknown";
  setItem(STORAGE_KEYS.lessons, lessons);

  if (oldCourseId) {
    const courses = getItem<StoredCourse[]>(STORAGE_KEYS.courses, []);
    const cIdx = courses.findIndex((c) => c.courseId === oldCourseId);
    if (cIdx !== -1) {
      courses[cIdx].lessonOrder = courses[cIdx].lessonOrder.filter((id) => id !== lessonId);
      courses[cIdx].updatedAt = now;
      setItem(STORAGE_KEYS.courses, courses);
    }
  }

  appendAudit(caller, "LESSON_DETACHED", "lessons", lessonId, `Detached from course ${oldCourseId}`);
  return ok({ lessonId, detached: true });
}

/* ── Blocks ───────────────────────────────────────────────────────── */

function addBlock(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, type, order = 0, title = "", textData, quizData, assetUrl, fileName, s3Bucket, s3Key } = body;
  if (!lessonId) return fail(400, "lessonId is required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const idx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (idx === -1) return fail(404, "Lesson not found");

  const blockId = `blk_${uid()}`;
  const block: StoredBlock = { blockId, type: type || "TEXT", title, order };
  if (textData) block.textData = textData;
  if (quizData !== undefined) block.quizData = quizData;
  if (assetUrl) block.assetUrl = assetUrl;
  if (fileName) block.fileName = fileName;
  if (s3Bucket) block.s3Bucket = String(s3Bucket);
  if (s3Key) block.s3Key = String(s3Key);

  lessons[idx].blocks.push(block);
  lessons[idx].updatedAt = new Date().toISOString();
  lessons[idx].updatedBy = caller?.userId ?? lessons[idx].updatedBy;
  lessons[idx].version += 1;
  setItem(STORAGE_KEYS.lessons, lessons);

  saveVersionSnapshot(lessonId, lessons[idx], caller);

  return ok(block);
}

function updateBlock(body: any, caller: any): Result {
  const { lessonId, blockId, title, order, textData, quizData, assetUrl, fileName, s3Bucket, s3Key } = body;
  if (!lessonId || !blockId) return fail(400, "lessonId and blockId are required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lIdx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (lIdx === -1) return fail(404, "Lesson not found");

  const bIdx = lessons[lIdx].blocks.findIndex((b) => b.blockId === blockId);
  if (bIdx === -1) return fail(404, "Block not found");

  const blk = lessons[lIdx].blocks[bIdx];
  if (title !== undefined) blk.title = title;
  if (order !== undefined) blk.order = order;
  if (textData !== undefined) blk.textData = textData;
  if (quizData !== undefined) blk.quizData = quizData;
  if (assetUrl !== undefined) blk.assetUrl = assetUrl;
  if (fileName !== undefined) blk.fileName = fileName;
  if (s3Bucket !== undefined) blk.s3Bucket = s3Bucket;
  if (s3Key !== undefined) blk.s3Key = s3Key;

  lessons[lIdx].updatedAt = new Date().toISOString();
  lessons[lIdx].updatedBy = caller?.userId ?? lessons[lIdx].updatedBy;
  lessons[lIdx].version += 1;
  setItem(STORAGE_KEYS.lessons, lessons);

  saveVersionSnapshot(lessonId, lessons[lIdx], caller);

  return ok({ blockId, updated: true });
}

function removeBlock(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, blockId } = body;
  if (!lessonId || !blockId) return fail(400, "lessonId and blockId are required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lIdx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (lIdx === -1) return fail(404, "Lesson not found");

  lessons[lIdx].blocks = lessons[lIdx].blocks.filter((b) => b.blockId !== blockId);
  lessons[lIdx].updatedAt = new Date().toISOString();
  lessons[lIdx].updatedBy = caller?.userId ?? lessons[lIdx].updatedBy;
  lessons[lIdx].version += 1;
  setItem(STORAGE_KEYS.lessons, lessons);

  saveVersionSnapshot(lessonId, lessons[lIdx], caller);

  return ok({ deleted: true });
}

function reorderBlocks(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, blockOrder } = body;
  if (!lessonId || !Array.isArray(blockOrder)) return fail(400, "lessonId and blockOrder are required");

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lIdx = lessons.findIndex((l) => l.lessonId === lessonId);
  if (lIdx === -1) return fail(404, "Lesson not found");

  const blockMap = new Map(lessons[lIdx].blocks.map((b) => [b.blockId, b]));
  const reordered: StoredBlock[] = [];
  blockOrder.forEach((id: string, i: number) => {
    const b = blockMap.get(id);
    if (b) reordered.push({ ...b, order: i });
  });
  lessons[lIdx].blocks.forEach((b) => {
    if (!blockOrder.includes(b.blockId)) reordered.push(b);
  });

  lessons[lIdx].blocks = reordered;
  lessons[lIdx].updatedAt = new Date().toISOString();
  lessons[lIdx].updatedBy = caller?.userId ?? lessons[lIdx].updatedBy;
  setItem(STORAGE_KEYS.lessons, lessons);

  return ok({ updated: true });
}

/* ── Upload URL (mock) ────────────────────────────────────────────── */

function mockUploadUrl(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, fileName } = body;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const assetKey = `mock-asset://${lessonId}/${ts}_${rand}_${fileName}`;
  return ok({
    uploadUrl: assetKey,
    assetUrl: assetKey,
    s3Bucket: "learninglab-assets",
    s3Key: assetKey,
  });
}

/* ── History ──────────────────────────────────────────────────────── */

function getLessonHistory(body: any, caller: any): Result {
  const denied = assertStaff(caller);
  if (denied) return denied;
  const { lessonId, limit = 50 } = body;
  const versions = getItem<Record<string, StoredVersionSnapshot[]>>(STORAGE_KEYS.lessonVersions, {});
  const history = (versions[lessonId] ?? []).slice(-limit);
  return ok({ history });
}

function normStr(v: unknown): string {
  return String(v ?? "").trim();
}

function arraysEqualNorm(a: unknown[], b: unknown[]): boolean {
  const x = a.map(normStr).sort();
  const y = b.map(normStr).sort();
  if (x.length !== y.length) return false;
  return x.every((v, i) => v === y[i]);
}

function submitQuiz(body: any, caller: any): Result {
  if (!caller) return fail(401, "Authentication required");
  const { lessonId, blockId, answers } = body;
  if (!lessonId || !blockId) return fail(400, "lessonId and blockId are required");
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return fail(400, "answers must be an object keyed by questionId");
  }

  const lessons = getItem<StoredLesson[]>(STORAGE_KEYS.lessons, []);
  const lesson = lessons.find((l) => l.lessonId === lessonId);
  if (!lesson) return fail(404, "Lesson not found");

  const block = lesson.blocks.find((b) => b.blockId === blockId);
  if (!block) return fail(404, "Quiz block not found");
  if (String(block.type).toUpperCase() !== "QUIZ") return fail(400, "Block is not a quiz");

  let qList: any[] = [];
  if (block.quizData && typeof block.quizData === "object" && Array.isArray((block.quizData as any).questions)) {
    qList = (block.quizData as any).questions;
  } else if (block.textData) {
    try {
      const parsed = JSON.parse(block.textData);
      if (Array.isArray(parsed?.questions)) qList = parsed.questions;
    } catch {
      return fail(400, "Quiz data missing");
    }
  }
  if (qList.length === 0) return fail(400, "Quiz data missing");

  const results: any[] = [];
  let correctCount = 0;

  for (const raw of qList) {
    const q = raw as Record<string, unknown>;
    const qid = normStr(q.id);
    if (!qid) continue;
    const prompt = normStr(q.question ?? q.prompt ?? q.text ?? qid);
    const typeStr = String(q.type ?? "").toLowerCase();
    const isMulti = typeStr.includes("multi") || typeStr === "multiple";
    const submitted = answers[qid];
    const ans = q.answers ?? q.correctAnswers;
    const single = q.answer ?? q.correctAnswer;
    let correctVals: unknown[] = [];
    if (Array.isArray(ans)) correctVals = [...ans];
    else if (single !== undefined && single !== null) correctVals = [single];
    else if (q.correctId != null) {
      const opts = Array.isArray(q.options) ? q.options : [];
      const cid = normStr(q.correctId);
      const hit = opts.find((o: any) => normStr(o?.id) === cid);
      if (hit && typeof hit === "object" && "text" in hit) correctVals = [(hit as any).text];
      else correctVals = [cid];
    }

    let isCorrect = false;
    if (isMulti) {
      const subArr = Array.isArray(submitted) ? submitted : submitted != null ? [submitted] : [];
      isCorrect = arraysEqualNorm(subArr, correctVals);
    } else {
      const subOne = Array.isArray(submitted) ? submitted[0] : submitted;
      isCorrect =
        correctVals.length > 0 &&
        normStr(subOne) === normStr(correctVals[0]);
    }
    if (isCorrect) correctCount++;
    results.push({
      questionId: qid,
      question: prompt,
      submittedAnswer: submitted,
      correctAnswer: isMulti ? correctVals : correctVals[0],
      isCorrect,
    });
  }

  const totalQuestions = results.length;
  const scorePercent = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passThreshold = 70;
  const passed = scorePercent >= passThreshold;

  const courseId = lesson.courseId;
  const now = new Date().toISOString();
  let progressRow: any = null;

  if (courseId && passed) {
    const enrollments = getItem<StoredEnrollment[]>(STORAGE_KEYS.enrollments, []);
    const enrolled =
      caller.roleId === "ADMIN" ||
      caller.roleId === "TEACHER" ||
      enrollments.some((e) => e.userId === caller.userId && e.courseId === courseId && e.status !== "DROPPED");
    if (!enrolled) return fail(403, "You must be enrolled in this course to record quiz progress");

    const completions = getItem<StoredCompletion[]>(STORAGE_KEYS.completions, []);
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
    progressRow = {
      userId: caller.userId,
      lessonId,
      courseId,
      progress: 100,
      completed: true,
      lastViewedAt: now,
      completedAt: now,
    };
  }

  return ok({
    lessonId,
    blockId,
    scorePercent,
    passed,
    correctCount,
    totalQuestions,
    progress: progressRow,
    results,
  });
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function saveVersionSnapshot(lessonId: string, lesson: StoredLesson, caller: any) {
  const versions = getItem<Record<string, StoredVersionSnapshot[]>>(STORAGE_KEYS.lessonVersions, {});
  if (!versions[lessonId]) versions[lessonId] = [];
  versions[lessonId].push({
    version: lesson.version,
    savedAt: new Date().toISOString(),
    savedBy: caller?.userId ?? "unknown",
    snapshot: { ...lesson },
  });
  setItem(STORAGE_KEYS.lessonVersions, versions);
}

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
