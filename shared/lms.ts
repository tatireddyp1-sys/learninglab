/**
 * Learning Lab LMS domain types (shared client/server).
 * UI is permission-driven; roles map to capabilities — extend via permissions, not hardcoded checks only.
 */

export type UserRole = "admin" | "teacher" | "student";

export type CourseStatus = "draft" | "published";

export type EnrollmentStatus = "active" | "completed" | "dropped";

export type LessonBlockType = "video" | "pdf" | "text" | "quiz" | "download";

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  title?: string;
  /** Plain text or markdown for text blocks */
  body?: string;
  /** Asset URL after upload (client may use blob: for demo) */
  assetUrl?: string;
  fileName?: string;
  order: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  blocks: LessonBlock[];
  /** Sequential lock: lesson N+1 locked until N complete */
  sequential: boolean;
  /** Soft delete for viewer */
  deleted?: boolean;
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

export interface Course {
  id: string;
  title: string;
  description: string;
  status: CourseStatus;
  createdBy: string;
  createdByName?: string;
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
