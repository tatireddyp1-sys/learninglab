import type {
  Course,
  Enrollment,
  Lesson,
  LessonCompletion,
  LessonVersionSnapshot,
} from "@shared/lms";

const KEYS = {
  courses: "lms_courses",
  lessons: "lms_lessons",
  enrollments: "lms_enrollments",
  completions: "lms_lesson_completions",
  versions: "lms_lesson_versions",
} as const;

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCourses(): Course[] {
  return parse(localStorage.getItem(KEYS.courses), [] as Course[]);
}

export function saveCourses(courses: Course[]) {
  localStorage.setItem(KEYS.courses, JSON.stringify(courses));
}

export function loadLessons(): Lesson[] {
  return parse(localStorage.getItem(KEYS.lessons), [] as Lesson[]);
}

export function saveLessons(lessons: Lesson[]) {
  localStorage.setItem(KEYS.lessons, JSON.stringify(lessons));
}

export function loadEnrollments(): Enrollment[] {
  return parse(localStorage.getItem(KEYS.enrollments), [] as Enrollment[]);
}

export function saveEnrollments(rows: Enrollment[]) {
  localStorage.setItem(KEYS.enrollments, JSON.stringify(rows));
}

export function loadCompletions(): LessonCompletion[] {
  return parse(localStorage.getItem(KEYS.completions), [] as LessonCompletion[]);
}

export function saveCompletions(rows: LessonCompletion[]) {
  localStorage.setItem(KEYS.completions, JSON.stringify(rows));
}

export function loadVersions(): Record<string, LessonVersionSnapshot[]> {
  return parse(localStorage.getItem(KEYS.versions), {} as Record<string, LessonVersionSnapshot[]>);
}

export function saveVersions(v: Record<string, LessonVersionSnapshot[]>) {
  localStorage.setItem(KEYS.versions, JSON.stringify(v));
}
