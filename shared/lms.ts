/**
 * Learning Lab LMS domain types (shared client/server).
 * UI is permission-driven; roles map to capabilities — extend via permissions, not hardcoded checks only.
 */

export type UserRole = "admin" | "teacher" | "student";

export type CourseStatus = "draft" | "published" | "archived" | "deleted";

export type EnrollmentStatus = "active" | "completed" | "dropped" | "suspended";

export type LessonBlockType = "video" | "pdf" | "text" | "quiz" | "download" | "image";

/** Uppercase API block type names used by the backend */
export type ApiBlockType = "TEXT" | "VIDEO" | "QUIZ" | "DOCUMENT" | "IMAGE";

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  title?: string;
  /** Plain text or markdown for text blocks */
  body?: string;
  /** QUIZ: structured payload from API (`quizData`) — used for authoring + grading UI */
  quizData?: unknown;
  /** Asset URL after upload */
  assetUrl?: string;
  fileName?: string;
  /** Set after getUploadUrl / API — sent on addBlock/updateBlock for media */
  s3Bucket?: string;
  s3Key?: string;
  order: number;
}

export function toApiBlockType(t: LessonBlockType): ApiBlockType {
  const map: Record<LessonBlockType, ApiBlockType> = {
    text: "TEXT",
    video: "VIDEO",
    pdf: "DOCUMENT",
    quiz: "QUIZ",
    download: "DOCUMENT",
    image: "IMAGE",
  };
  return map[t] ?? "TEXT";
}

export function fromApiBlockType(t: string): LessonBlockType {
  const upper = t.toUpperCase();
  if (upper === "TEXT") return "text";
  if (upper === "VIDEO") return "video";
  if (upper === "DOCUMENT") return "pdf";
  if (upper === "QUIZ") return "quiz";
  if (upper === "IMAGE") return "image";
  return "text";
}

export function mapApiBlock(b: any): LessonBlock {
  let type = fromApiBlockType(String(b.type ?? "TEXT"));
  if (type === "pdf" && b.fileName) {
    const ext = (b.fileName as string).split(".").pop()?.toLowerCase() ?? "";
    if (ext !== "pdf") type = "download";
  }
  const body = b.textData ?? b.body ?? undefined;
  const quizData = b.quizData !== undefined && b.quizData !== null ? b.quizData : undefined;
  return {
    id: String(b.blockId ?? b.id ?? ""),
    type,
    title: b.title ?? undefined,
    body: body != null ? String(body) : undefined,
    quizData,
    assetUrl: b.assetUrl ?? undefined,
    fileName: b.fileName ?? undefined,
    s3Bucket: b.s3Bucket != null ? String(b.s3Bucket) : undefined,
    s3Key: b.s3Key != null ? String(b.s3Key) : undefined,
    order: Number(b.order ?? 0),
  };
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  blocks: LessonBlock[];
  /** 1-based order from API listLessons when course lessonOrder is unavailable */
  lessonOrder?: number;
  /** Sequential lock: lesson N+1 locked until N complete */
  sequential: boolean;
  /** Server-side lock (e.g. sequential gating) from listLessons/getLesson */
  locked?: boolean;
  /** Soft delete for viewer */
  deleted?: boolean;
  /** Lesson author (for ownership checks when API provides it) */
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  version: number;
}

export interface LessonVersionSnapshot {
  savedAt: string;
  savedBy: string;
  version: number;
  lesson: Omit<Lesson, "version"> & { version: number };
}

/** `submitQuiz` action — success payload (subset used by UI) */
export interface LessonQuizSubmitResult {
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  results: Array<{
    questionId: string;
    question?: string;
    submittedAnswer: unknown;
    correctAnswer: unknown;
    isCorrect: boolean;
  }>;
  progress?: Record<string, unknown> | null;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  status: CourseStatus;
  createdBy: string;
  createdByName?: string;
  /** Co-teachers from API (`assignTeacher`); used for visibility and enrollment roster access */
  teacherIds?: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  /** Ordered lesson ids */
  lessonOrder: string[];
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  userName?: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt?: string;
}

/** Per-user lesson completion within a course */
export interface LessonCompletion {
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: string;
  lastActivityAt: string;
  /** 0–100 from PROGRESS API (`trackProgress` / row sync). */
  progressPercent?: number;
}

export type LmsPermission =
  | "course:create"
  | "course:edit_any"
  | "course:edit_own"
  | "course:delete_any"
  | "course:delete_own"
  | "course:publish_own"
  | "course:enroll"
  | "lesson:create"
  | "lesson:edit"
  | "lesson:view"
  | "lesson:delete"
  | "enrollment:manage"
  | "progress:view_all"
  | "progress:view_own"
  | "progress:view_course"
  | "admin:users"
  | "admin:roles"
  | "admin:audit";

/** User-defined role with an explicit permission set (stored client-side in demo). */
export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  permissions: LmsPermission[];
  createdAt: string;
  updatedAt: string;
}
