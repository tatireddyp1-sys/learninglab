/**
 * Client-side LMS RBAC helpers (mirror server rules; server remains authoritative).
 */

import type { User } from "@/context/AuthContext";
import type { Course, CustomRole, Enrollment, Lesson } from "@shared/lms";
import { can, canCreateCourse, canDeleteCourse, canEditCourse, isCourseManager } from "@/lib/permissions";

export function isAdminUser(user: User | null | undefined): boolean {
  return user?.role === "admin";
}

/** Compare API user ids (avoids invisible rows when casing/whitespace differs). */
export function sameActorId(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a == null || b == null) return false;
  return String(a).trim() === String(b).trim();
}

/** Creator or assigned teacher (API `teacherIds`). */
export function isCourseStaff(user: User | null | undefined, course: Course | undefined): boolean {
  if (!user || !course) return false;
  return isCourseManager(course, user.id);
}

/** Teachers without catalog-wide edit only manage courses they created. */
export function canManageCourse(
  user: User | null | undefined,
  customRoles: CustomRole[],
  course: Course | undefined,
  userId: string | undefined
): boolean {
  if (!user || !course) return false;
  if (isAdminUser(user)) return true;
  return canEditCourse(user, customRoles, course, userId);
}

/**
 * Staff and admins load the full lesson catalog; learners only load lessons for enrolled courses.
 * Do not use `lesson:create` here — JWT wildcards like `lessons:*` expand to include `lesson:create` and would
 * misclassify students as staff, causing `listLessons type=all` (often 403 for learners) and an empty UI.
 */
export function shouldLoadFullLessonCatalog(user: User | null | undefined, customRoles: CustomRole[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (can(user, customRoles, "course:edit_any", {})) return true;
  if (user.role === "teacher") return true;
  return false;
}

/** Roster operations: enrollments:create / enrollment:manage for courses the user staffs (creator or `teacherIds`). */
export function userCanManageCourseRoster(
  user: User | null | undefined,
  customRoles: CustomRole[],
  course: Course
): boolean {
  if (!user) return false;
  if (!can(user, customRoles, "enrollment:manage", {})) return false;
  if (user.role === "admin" || can(user, customRoles, "course:edit_any", {})) return true;
  return isCourseStaff(user, course);
}

export function assertCanCreateCourse(user: User | null | undefined, customRoles: CustomRole[]): void {
  if (!user) throw new Error("Not authenticated");
  if (!canCreateCourse(user, customRoles)) {
    throw new Error("You do not have permission to create courses");
  }
}

export function assertCanEditCourse(user: User | null | undefined, customRoles: CustomRole[], course: Course, userId: string | undefined): void {
  if (!canManageCourse(user, customRoles, course, userId)) {
    throw new Error("You do not have permission to edit this course");
  }
}

export function assertCanDeleteCourse(user: User | null | undefined, customRoles: CustomRole[], course: Course, userId: string | undefined): void {
  if (!user || !course) throw new Error("Not found");
  if (isAdminUser(user)) {
    if (!can(user, customRoles, "course:delete_any", { course, userId })) {
      throw new Error("You do not have permission to delete courses");
    }
    return;
  }
  if (!canDeleteCourse(user, customRoles, course, userId)) {
    throw new Error("You do not have permission to delete this course");
  }
}

export function assertCanAuthorLesson(
  user: User | null | undefined,
  customRoles: CustomRole[],
  course: Course | undefined,
  userId: string | undefined
): void {
  if (!user) throw new Error("Not authenticated");
  if (!can(user, customRoles, "lesson:create", {})) {
    throw new Error("You do not have permission to create lessons");
  }
  if (course && !canManageCourse(user, customRoles, course, userId)) {
    throw new Error("You do not have permission to add lessons to this course");
  }
}

export function assertCanMutateLesson(
  user: User | null | undefined,
  customRoles: CustomRole[],
  lesson: Lesson,
  course: Course | undefined,
  userId: string | undefined
): void {
  if (!user) throw new Error("Not authenticated");
  if (isAdminUser(user)) return;
  if (lesson.courseId) {
    if (!course) {
      // Course row may not be in client cache yet (e.g. right after createLesson + refresh, before re-render).
      if (!can(user, customRoles, "lesson:create", {})) {
        throw new Error("You do not have permission to edit this lesson");
      }
      return;
    }
    if (!canEditCourse(user, customRoles, course, userId)) {
      throw new Error("You do not have permission to edit this lesson");
    }
    return;
  }
  if (lesson.createdBy && lesson.createdBy !== user.id) {
    throw new Error("You can only edit your own lessons");
  }
  if (!can(user, customRoles, "lesson:create", {})) {
    throw new Error("You do not have permission to edit lessons");
  }
}

/**
 * Lesson/blocks/upload: allow when we have a resolved lesson + course, OR when the lesson is not
 * in React state yet (stale closure right after create) but the user may author blocks.
 */
export function assertLessonWriteAccess(
  user: User | null | undefined,
  customRoles: CustomRole[],
  lesson: Lesson | undefined,
  course: Course | undefined,
  userId: string | undefined
): void {
  if (!user) throw new Error("Not authenticated");
  if (lesson) {
    assertCanMutateLesson(user, customRoles, lesson, course, userId);
    return;
  }
  if (!can(user, customRoles, "lesson:create", {})) {
    throw new Error("You do not have permission to edit lessons");
  }
}

/** Soft-deleted courses may remain in client/API state but are omitted from catalog-style lists. */
export function excludeDeletedCourses(courses: Course[]): Course[] {
  return courses.filter((c) => c.status !== "deleted");
}

/**
 * When the API returns a broad catalog, narrow what non-admin teachers see in the UI.
 * Admins and users with `course:edit_any` see the full list.
 */
export function filterCoursesForViewer(
  user: User | null | undefined,
  customRoles: CustomRole[],
  courses: Course[]
): Course[] {
  if (!user) return [];
  if (user.role === "admin" || can(user, customRoles, "course:edit_any", {})) {
    return courses;
  }
  if (user.role === "teacher") {
    return courses.filter((c) => isCourseStaff(user, c));
  }
  return courses;
}

export function filterLessonsForViewer(
  user: User | null | undefined,
  customRoles: CustomRole[],
  lessons: Lesson[],
  courses: Course[],
  enrollments: Enrollment[] = []
): Lesson[] {
  if (!user) return [];
  if (user.role === "admin" || can(user, customRoles, "course:edit_any", {})) {
    return lessons;
  }
  if (user.role === "teacher") {
    const manageable = new Set(filterCoursesForViewer(user, customRoles, courses).map((c) => c.id));
    return lessons.filter((l) => {
      if (sameActorId(l.createdBy, user.id)) return true;
      if (!l.courseId) return !l.createdBy || sameActorId(l.createdBy, user.id);
      return manageable.has(l.courseId);
    });
  }
  const enrolledCourseIds = new Set(
    enrollments
      .filter(
        (e) =>
          sameActorId(e.userId, user.id) &&
          (e.status === "active" || e.status === "completed")
      )
      .map((e) => e.courseId)
  );
  return lessons.filter((l) => {
    if (!l.courseId) return false;
    if (!enrolledCourseIds.has(l.courseId)) return false;
    const course = courses.find((c) => c.id === l.courseId);
    if (course && course.status !== "published") return false;
    return true;
  });
}
