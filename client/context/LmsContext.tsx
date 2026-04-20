import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Course,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  LessonBlock,
  LessonBlockType,
  LessonCompletion,
  LessonQuizSubmitResult,
  LessonVersionSnapshot,
} from "@shared/lms";
import { mapApiBlock, toApiBlockType } from "@shared/lms";
import { useAuth } from "@/context/AuthContext";
import { useCustomRoles } from "@/context/CustomRolesContext";
import {
  getEnrollmentsDeleteAction,
  getEnvelopeError,
  isFailure,
  isLiveLmsHttpEnabled,
  postModule,
} from "@/lib/learningLabApi";
import { debugLmsListResponse, extractGetStudentProgressRows, extractListItems } from "@/lib/lmsListExtract";
import { mapApiProgressRowToLessonCompletion } from "@/lib/lmsProgressNormalize";
import {
  normalizeApiCourse,
  normalizeApiEnrollmentRow,
  normalizeApiLesson,
  normalizeUploadUrlPayload,
  courseStatusToApiEnum,
  extractLessonIdFromEnvelope,
} from "@/lib/lmsApiNormalize";
import {
  assertCanAuthorLesson,
  assertCanCreateCourse,
  assertCanDeleteCourse,
  assertCanEditCourse,
  assertCanMutateLesson,
  assertLessonWriteAccess,
  filterCoursesForViewer,
  filterLessonsForViewer,
  sameActorId,
  shouldLoadFullLessonCatalog,
  userCanManageCourseRoster,
} from "@/lib/lmsResourceAccess";
import { canPublishCourse } from "@/lib/permissions";
import { guessContentTypeFromFileName } from "@/lib/validators";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UploadUrlResult {
  uploadUrl: string;
  assetUrl: string;
  s3Bucket: string;
  s3Key: string;
}

interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  enrolledStudents: number;
  averageProgress: number;
  completionRate: number;
  studentBreakdown: any[];
}

interface LmsContextValue {
  courses: Course[];
  lessons: Lesson[];
  enrollments: Enrollment[];
  completions: LessonCompletion[];
  loading: boolean;
  error: string | null;
  lastMutationAt: number;
  refresh: () => Promise<void>;
  getCourse: (id: string) => Course | undefined;
  getLessonsForCourse: (courseId: string) => Lesson[];
  getLesson: (id: string) => Lesson | undefined;
  /** POST `getLesson` — merges into `lessons` (full blocks when list payloads omit them). */
  fetchLesson: (lessonId: string) => Promise<Lesson | null>;
  getEnrollment: (userId: string, courseId: string) => Enrollment | undefined;
  isEnrolled: (userId: string, courseId: string) => boolean;
  createCourse: (input: { title: string; description: string }) => Promise<Course>;
  updateCourse: (id: string, patch: Partial<Pick<Course, "title" | "description" | "status" | "lessonOrder">>) => Promise<Course | null>;
  deleteCourse: (id: string) => Promise<boolean>;
  publishCourse: (courseId: string) => Promise<void>;
  archiveCourse: (courseId: string) => Promise<void>;
  createLesson: (courseId: string, input: { title: string; description: string; sequential?: boolean }) => Promise<Lesson | null>;
  createStandaloneLesson: (input: { title: string; description: string; sequential?: boolean }) => Promise<Lesson | null>;
  attachLessonToCourse: (lessonId: string, courseId: string) => Promise<void>;
  detachLessonFromCourse: (lessonId: string) => Promise<void>;
  getStandaloneLessons: () => Lesson[];
  updateLesson: (
    lessonId: string,
    patch: { title?: string; description?: string; sequential?: boolean; lessonOrder?: number; baselineUpdatedAt?: string }
  ) => Promise<Lesson | null>;
  deleteLesson: (lessonId: string, baselineUpdatedAt?: string) => Promise<boolean>;
  publishLesson: (lessonId: string, baselineUpdatedAt?: string) => Promise<void>;
  archiveLesson: (lessonId: string, baselineUpdatedAt?: string) => Promise<void>;
  addBlock: (
    lessonId: string,
    block: {
      type: LessonBlockType;
      order: number;
      title?: string;
      body?: string;
      quizData?: unknown;
      assetUrl?: string;
      fileName?: string;
      s3Bucket?: string;
      s3Key?: string;
    }
  ) => Promise<LessonBlock | null>;
  updateBlock: (
    lessonId: string,
    blockId: string,
    patch: {
      title?: string;
      order?: number;
      body?: string;
      quizData?: unknown;
      assetUrl?: string;
      fileName?: string;
      s3Bucket?: string;
      s3Key?: string;
    }
  ) => Promise<void>;
  submitQuiz: (
    lessonId: string,
    blockId: string,
    answers: Record<string, string | string[]>
  ) => Promise<LessonQuizSubmitResult>;
  removeBlock: (lessonId: string, blockId: string) => Promise<void>;
  reorderBlocks: (lessonId: string, blockOrder: string[]) => Promise<void>;
  getUploadUrl: (
    lessonId: string,
    fileName: string,
    contentType: string,
    type: LessonBlockType,
    blockId?: string
  ) => Promise<UploadUrlResult>;
  reorderLessons: (courseId: string, lessonIds: string[]) => Promise<void>;
  assignTeacher: (courseId: string, teacherId: string) => Promise<void>;
  removeTeacher: (courseId: string, teacherId: string) => Promise<void>;
  enroll: (courseId: string) => Promise<Enrollment | null>;
  enrollUserInCourse: (courseId: string, targetUserId: string) => Promise<Enrollment | null>;
  /** POST `deleteEnrollment` — drop `userId` from `courseId` (learner self or roster). */
  deleteEnrollment: (courseId: string, userId: string) => Promise<void>;
  dropEnrollment: (courseId: string) => Promise<void>;
  setEnrollmentStatus: (enrollmentId: string, status: EnrollmentStatus) => Promise<void>;
  markLessonComplete: (courseId: string, lessonId: string) => Promise<void>;
  startLessonProgress: (lessonId: string, courseId: string) => Promise<void>;
  trackLessonProgress: (lessonId: string, courseId: string, progress: number) => Promise<void>;
  /** POST `getLessonProgress` — merges into `completions` when the row exists or has activity. */
  fetchLessonProgress: (lessonId: string, opts?: { userId?: string }) => Promise<LessonCompletion | null>;
  getCourseProgressPercent: (userId: string, courseId: string) => number;
  getCompletedLessonIds: (userId: string, courseId: string) => Set<string>;
  isLessonLocked: (userId: string, course: Course, lesson: Lesson) => boolean;
  fetchLessonHistory: (lessonId: string, limit?: number) => Promise<LessonVersionSnapshot[]>;
  getLessonHistory: (lessonId: string) => LessonVersionSnapshot[];
  fetchCourseProgressSummary: (courseId: string) => Promise<CourseProgressSummary | null>;
  checkStaleCourse: (courseId: string, baselineUpdatedAt: string) => boolean;
  checkStaleLesson: (lessonId: string, baselineUpdatedAt: string) => boolean;
}

const LmsContext = createContext<LmsContextValue | undefined>(undefined);

export function LmsProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { roles: customRoles } = useCustomRoles();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [completions, setCompletions] = useState<LessonCompletion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMutationAt, setLastMutationAt] = useState(0);
  const [historyCache, setHistoryCache] = useState<Record<string, LessonVersionSnapshot[]>>({});

  const touch = useCallback(() => setLastMutationAt(Date.now()), []);

  const upsertCompletion = useCallback((row: LessonCompletion) => {
    setCompletions((prev) => {
      const idx = prev.findIndex(
        (c) => c.userId === row.userId && c.courseId === row.courseId && c.lessonId === row.lessonId
      );
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }, []);

  // ─── Refresh ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const now = new Date().toISOString();

    // 1) Courses — critical; if this fails, bail with an error.
    let mappedCourses: Course[] = [];
    try {
      const { status: cHttp, envelope: cEnv } = await postModule<{ action: "listCourses" }, any>(
        "courses",
        { action: "listCourses" },
        { accessToken }
      );
      const courseRows = isFailure(cEnv) ? [] : extractListItems(cEnv.data);
      debugLmsListResponse("courses", "listCourses", cHttp, cEnv, courseRows);
      if (isFailure(cEnv)) throw new Error(getEnvelopeError(cEnv));
      mappedCourses = courseRows.map((c: any) =>
        normalizeApiCourse(c as Record<string, unknown>, user.id, now)
      );
      mappedCourses = filterCoursesForViewer(user, customRoles, mappedCourses);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setLoading(false);
      return;
    }

    // Commit courses immediately so the UI shows them even if later calls fail.
    setCourses(mappedCourses);

    // 2) Enrollments first — learners must know ACTIVE enrollments before any course-scoped lesson reads.
    let mappedEnrollments: Enrollment[] = [];
    try {
      const merge = new Map<string, Enrollment>();
      const putRow = (raw: Record<string, unknown>) => {
        const row = normalizeApiEnrollmentRow(raw, user.id, now);
        if (!row.courseId || !row.userId) return;
        merge.set(`${row.courseId}\0${row.userId}`, row);
      };

      const { status: eHttp, envelope: eEnv } = await postModule<{ action: "listStudentEnrollments" }, any>(
        "enrollments",
        { action: "listStudentEnrollments" },
        { accessToken }
      );
      const eRows = eEnv.success && !isFailure(eEnv) ? extractListItems(eEnv.data) : [];
      debugLmsListResponse("enrollments", "listStudentEnrollments", eHttp, eEnv, eRows);
      if (eEnv.success && !isFailure(eEnv)) {
        for (const r of eRows) putRow(r as Record<string, unknown>);
      }

      if (isLiveLmsHttpEnabled("enrollments")) {
        const rosterCourses = mappedCourses.filter((c) => userCanManageCourseRoster(user, customRoles, c));
        await Promise.all(
          rosterCourses.map(async (c) => {
            const { envelope: rEnv } = await postModule<{ action: "listCourseEnrollments"; courseId: string }, any>(
              "enrollments",
              { action: "listCourseEnrollments", courseId: c.id },
              { accessToken }
            );
            if (!rEnv.success || isFailure(rEnv)) return;
            for (const r of extractListItems(rEnv.data)) putRow(r as Record<string, unknown>);
          })
        );
      }

      mappedEnrollments = Array.from(merge.values());
    } catch {
      mappedEnrollments = [];
    }
    setEnrollments(mappedEnrollments);

    // 3) Lessons — staff: broad list; learners: only listLessons type=course for enrolled published courses.
    let mappedLessons: Lesson[] = [];
    try {
      const byId = new Map<string, Lesson>();
      const mergeRows = (raw: any[]) => {
        for (const row of raw) {
          const l = normalizeApiLesson(row as Record<string, unknown>, user.id, now);
          if (l.id && !byId.has(l.id)) byId.set(l.id, l);
        }
      };

      const pull = async (label: string, body: Record<string, unknown>) => {
        const { status: http, envelope: env } = await postModule<any, any>("lessons", body, { accessToken });
        const rows = env.success && !isFailure(env) ? extractListItems(env.data) : [];
        debugLmsListResponse("lessons", label, http, env, rows);
        if (env.success && !isFailure(env)) mergeRows(rows);
        return rows.length;
      };

      const staffCatalog = shouldLoadFullLessonCatalog(user, customRoles);

      if (staffCatalog) {
        await pull("listLessons type=all", { action: "listLessons", type: "all" });

        if (byId.size === 0) {
          for (const c of mappedCourses) {
            await pull(`listLessons type=course courseId=${c.id}`, {
              action: "listLessons",
              type: "course",
              courseId: c.id,
            });
          }
        }

        if (byId.size === 0) {
          await pull("listLessons legacy (no type)", { action: "listLessons" });
        }

        if (byId.size === 0) {
          await pull("listAllLessons", { action: "listAllLessons" });
        }
      } else {
        const enrolledCourseIds = [
          ...new Set(
            mappedEnrollments
              .filter(
                (e) =>
                  sameActorId(e.userId, user.id) &&
                  (e.status === "active" || e.status === "completed")
              )
              .map((e) => e.courseId)
          ),
        ];
        for (const cid of enrolledCourseIds) {
          await pull(`listLessons type=course courseId=${cid}`, {
            action: "listLessons",
            type: "course",
            courseId: cid,
          });
        }
        if (byId.size === 0 && enrolledCourseIds.length > 0) {
          await pull("listLessons learner fallback type=all", { action: "listLessons", type: "all" });
        }
      }

      mappedLessons = filterLessonsForViewer(
        user,
        customRoles,
        Array.from(byId.values()),
        mappedCourses,
        mappedEnrollments
      );
    } catch {
      mappedLessons = [];
    }
    setLessons(mappedLessons);

    // 4) Progress — best-effort.
    let mappedCompletions: LessonCompletion[] = [];
    try {
      const { status: pHttp, envelope: pEnv } = await postModule<{ action: "getStudentProgress" }, any>(
        "progress",
        { action: "getStudentProgress" },
        { accessToken }
      );
      const pRows = pEnv.success && !isFailure(pEnv) ? extractGetStudentProgressRows(pEnv.data) : [];
      debugLmsListResponse("progress", "getStudentProgress", pHttp, pEnv, pRows);
      if (pEnv.success && !isFailure(pEnv)) {
        mappedCompletions = pRows
          .map((p) => mapApiProgressRowToLessonCompletion(p, user.id))
          .filter((c): c is LessonCompletion => c != null);
      }
    } catch {
      mappedCompletions = [];
    }
    setCompletions(mappedCompletions);

    touch();
    setLoading(false);
  }, [accessToken, user, customRoles, touch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ─── Lookups ──────────────────────────────────────────────────────────
  const getCourse = useCallback((id: string) => courses.find((c) => c.id === id), [courses]);

  const getLessonsForCourse = useCallback(
    (courseId: string) =>
      lessons
        .filter((l) => l.courseId === courseId && !l.deleted)
        .sort((a, b) => {
          const order = getCourse(courseId)?.lessonOrder ?? [];
          const ia = order.indexOf(a.id);
          const ib = order.indexOf(b.id);
          if (ia !== -1 || ib !== -1) {
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
          }
          const ao = a.lessonOrder ?? Number.MAX_SAFE_INTEGER;
          const bo = b.lessonOrder ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return a.createdAt.localeCompare(b.createdAt);
        }),
    [courses, lessons, getCourse]
  );

  const getLesson = useCallback((id: string) => lessons.find((l) => l.id === id), [lessons]);

  const fetchLesson = useCallback(
    async (lessonId: string): Promise<Lesson | null> => {
      if (!user || !lessonId) return null;
      const now = new Date().toISOString();
      const { status, envelope } = await postModule<{ action: "getLesson"; lessonId: string }, any>(
        "lessons",
        { action: "getLesson", lessonId },
        { accessToken }
      );
      if (status === 409) throw new Error("Lesson was modified by another user. Refresh and retry.");
      if (status === 403) {
        throw new Error(
          "This lesson is locked or you do not have access yet. Complete previous lessons, or confirm your enrollment is active."
        );
      }
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const row = envelope.data as Record<string, unknown>;
      const mapped = normalizeApiLesson(row, user.id, now);
      if (!mapped.id) return null;
      setLessons((prev) => {
        const i = prev.findIndex((l) => l.id === mapped.id);
        if (i === -1) return [...prev, mapped];
        const next = [...prev];
        next[i] = mapped;
        return next;
      });
      return mapped;
    },
    [accessToken, user]
  );

  const getEnrollment = useCallback(
    (userId: string, courseId: string) =>
      enrollments.find(
        (e) =>
          e.userId === userId &&
          e.courseId === courseId &&
          e.status !== "dropped" &&
          e.status !== "suspended"
      ),
    [enrollments]
  );

  const isEnrolled = useCallback(
    (userId: string, courseId: string) => !!getEnrollment(userId, courseId),
    [getEnrollment]
  );

  // ─── Courses ──────────────────────────────────────────────────────────
  const createCourse = useCallback(
    async (input: { title: string; description: string }): Promise<Course> => {
      assertCanCreateCourse(user, customRoles);
      const { envelope } = await postModule<{ action: "createCourse"; title: string; description?: string }, any>(
        "courses",
        { action: "createCourse", title: input.title, description: input.description || undefined },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const d = (envelope.data ?? {}) as Record<string, unknown>;
      const createdId = String(d.courseId ?? d.id ?? uid());
      const nowIso = new Date().toISOString();
      const optimistic = normalizeApiCourse(
        {
          ...d,
          courseId: createdId,
          title: d.title ?? input.title,
          description: d.description ?? input.description,
          createdBy: d.createdBy ?? user.id,
          createdByName: d.createdByName ?? user.name,
        },
        user.id,
        nowIso
      );
      if (!optimistic.id) optimistic.id = createdId;
      setCourses((prev) => [...prev, optimistic]);
      touch();
      refresh().catch(() => {});
      return optimistic;
    },
    [accessToken, refresh, user, touch, customRoles]
  );

  const updateCourse = useCallback(
    async (id: string, patch: Partial<Pick<Course, "title" | "description" | "status" | "lessonOrder">>) => {
      if (!user) return null;
      const existing = courses.find((c) => c.id === id);
      if (existing) assertCanEditCourse(user, customRoles, existing, user.id);
      const liveCourses = isLiveLmsHttpEnabled("courses");
      const body: Record<string, any> = { action: "updateCourse", courseId: id };
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.description !== undefined) body.description = patch.description;
      if (!liveCourses) {
        if (patch.status !== undefined) body.status = courseStatusToApiEnum(patch.status);
        if (patch.lessonOrder !== undefined) body.lessonOrder = patch.lessonOrder;
      }
      const { envelope } = await postModule<any, any>("courses", body, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      touch();
      refresh().catch(() => {});
      return envelope.data ?? null;
    },
    [accessToken, refresh, user, touch, customRoles, courses]
  );

  const publishCourse = useCallback(
    async (courseId: string) => {
      if (!user) throw new Error("Not authenticated");
      const c = courses.find((x) => x.id === courseId);
      if (!c) throw new Error("Course not found");
      if (!canPublishCourse(user, customRoles, c, user.id)) {
        throw new Error("You do not have permission to publish this course");
      }
      const { envelope } = await postModule<{ action: "publishCourse"; courseId: string }, any>(
        "courses",
        { action: "publishCourse", courseId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      setCourses((prev) => prev.map((x) => (x.id === courseId ? { ...x, status: "published" as const } : x)));
      touch();
      refresh().catch(() => {});
    },
    [accessToken, refresh, touch, user, customRoles, courses]
  );

  const archiveCourse = useCallback(
    async (courseId: string) => {
      if (!user) throw new Error("Not authenticated");
      const c = courses.find((x) => x.id === courseId);
      if (!c) throw new Error("Course not found");
      assertCanEditCourse(user, customRoles, c, user.id);
      const { envelope } = await postModule<{ action: "archiveCourse"; courseId: string }, any>(
        "courses",
        { action: "archiveCourse", courseId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      setCourses((prev) => prev.map((x) => (x.id === courseId ? { ...x, status: "archived" as const } : x)));
      touch();
      refresh().catch(() => {});
    },
    [accessToken, refresh, touch, user, customRoles, courses]
  );

  const deleteCourse = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const c = courses.find((x) => x.id === id);
      if (c) assertCanDeleteCourse(user, customRoles, c, user.id);
      const { envelope } = await postModule<{ action: "deleteCourse"; courseId: string }, any>(
        "courses",
        { action: "deleteCourse", courseId: id },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      setCourses((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: "deleted" as const } : x))
      );
      touch();
      refresh().catch(() => {});
      return true;
    },
    [accessToken, refresh, touch, user, customRoles, courses]
  );

  const assignTeacher = useCallback(
    async (courseId: string, teacherId: string) => {
      if (!user) throw new Error("Not authenticated");
      const c = courses.find((x) => x.id === courseId);
      if (!c) throw new Error("Course not found");
      assertCanEditCourse(user, customRoles, c, user.id);
      const { envelope } = await postModule<{ action: "assignTeacher"; courseId: string; teacherId: string }, any>(
        "courses",
        { action: "assignTeacher", courseId, teacherId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const ids = (envelope.data as { teacherIds?: string[] })?.teacherIds;
      if (Array.isArray(ids)) {
        setCourses((prev) => prev.map((x) => (x.id === courseId ? { ...x, teacherIds: ids } : x)));
      }
      touch();
      refresh().catch(() => {});
    },
    [accessToken, refresh, touch, user, customRoles, courses]
  );

  const removeTeacher = useCallback(
    async (courseId: string, teacherId: string) => {
      if (!user) throw new Error("Not authenticated");
      const c = courses.find((x) => x.id === courseId);
      if (!c) throw new Error("Course not found");
      assertCanEditCourse(user, customRoles, c, user.id);
      const { envelope } = await postModule<{ action: "removeTeacher"; courseId: string; teacherId: string }, any>(
        "courses",
        { action: "removeTeacher", courseId, teacherId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const ids = (envelope.data as { teacherIds?: string[] })?.teacherIds;
      if (Array.isArray(ids)) {
        setCourses((prev) => prev.map((x) => (x.id === courseId ? { ...x, teacherIds: ids } : x)));
      }
      touch();
      refresh().catch(() => {});
    },
    [accessToken, refresh, touch, user, customRoles, courses]
  );

  // ─── Lessons ──────────────────────────────────────────────────────────
  const createLesson = useCallback(
    async (courseId: string, input: { title: string; description: string; sequential?: boolean }) => {
      if (!user) return null;
      const course = courses.find((c) => c.id === courseId);
      if (!course) {
        throw new Error("Course not found. Wait for the catalog to load, then try again.");
      }
      assertCanAuthorLesson(user, customRoles, course, user.id);
      // 1-based position within the course; must match contract POST /lessons createLesson.
      const lessonOrder = (course.lessonOrder?.length ?? 0) + 1;
      const { envelope } = await postModule<any, any>(
        "lessons",
        {
          action: "createLesson",
          courseId,
          title: input.title,
          lessonOrder,
          description: input.description || undefined,
          sequential: input.sequential ?? true,
        },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const lessonId = extractLessonIdFromEnvelope(envelope.data);
      await refresh();
      if (!lessonId) return null;
      return {
        id: lessonId,
        courseId,
        title: input.title,
        description: input.description || "",
        blocks: [],
        sequential: input.sequential ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        version: 1,
      } satisfies Lesson;
    },
    [accessToken, refresh, user, customRoles, courses]
  );

  const createStandaloneLesson = useCallback(
    async (input: { title: string; description: string; sequential?: boolean }) => {
      if (!user) return null;
      assertCanAuthorLesson(user, customRoles, undefined, user.id);
      const { envelope } = await postModule<any, any>(
        "lessons",
        {
          action: "createLesson",
          courseId: "",
          title: input.title,
          lessonOrder: 1,
          description: input.description || undefined,
          sequential: input.sequential ?? true,
        },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const lessonId = extractLessonIdFromEnvelope(envelope.data);
      await refresh();
      if (!lessonId) return null;
      return {
        id: lessonId,
        courseId: "",
        title: input.title,
        description: input.description || "",
        blocks: [],
        sequential: input.sequential ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        version: 1,
      } satisfies Lesson;
    },
    [accessToken, refresh, user, customRoles]
  );

  const attachLessonToCourse = useCallback(
    async (lessonId: string, courseId: string) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = courses.find((c) => c.id === courseId);
      if (lesson && course) assertCanMutateLesson(user, customRoles, lesson, course, user.id);
      else if (course) assertCanAuthorLesson(user, customRoles, course, user.id);
      const attachOrder = course ? (course.lessonOrder?.length ?? 0) + 1 : 1;
      const { envelope } = await postModule<any, any>(
        "lessons",
        { action: "attachLessonToCourse", lessonId, courseId, lessonOrder: attachOrder },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const detachLessonFromCourse = useCallback(
    async (lessonId: string) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      if (lesson) assertCanMutateLesson(user, customRoles, lesson, course, user.id);
      const { envelope } = await postModule<any, any>(
        "lessons",
        { action: "detachLessonFromCourse", lessonId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const getStandaloneLessons = useCallback(
    () => lessons.filter((l) => !l.courseId && !l.deleted),
    [lessons]
  );

  const updateLesson = useCallback(
    async (
      lessonId: string,
      patch: { title?: string; description?: string; sequential?: boolean; lessonOrder?: number; baselineUpdatedAt?: string }
    ) => {
      if (!user) return null;
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      if (lesson) assertCanMutateLesson(user, customRoles, lesson, course, user.id);
      const body: Record<string, any> = { action: "updateLesson", lessonId };
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.description !== undefined) body.description = patch.description;
      if (patch.sequential !== undefined) body.sequential = patch.sequential;
      if (patch.lessonOrder !== undefined) body.lessonOrder = patch.lessonOrder;
      if (patch.baselineUpdatedAt) body.baselineUpdatedAt = patch.baselineUpdatedAt;
      const { status, envelope } = await postModule<any, any>("lessons", body, { accessToken });
      if (status === 409) throw new Error("Lesson was modified by another user. Refresh and retry.");
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
      return envelope.data ?? null;
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const deleteLesson = useCallback(
    async (lessonId: string, baselineUpdatedAt?: string) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      if (lesson) assertCanMutateLesson(user, customRoles, lesson, course, user.id);
      const body: Record<string, unknown> = { action: "deleteLesson", lessonId };
      if (baselineUpdatedAt) body.baselineUpdatedAt = baselineUpdatedAt;
      const { status, envelope } = await postModule<any, any>("lessons", body as any, { accessToken });
      if (status === 409) throw new Error("Lesson was modified by another user. Refresh and retry.");
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
      return true;
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const publishLesson = useCallback(
    async (lessonId: string, baselineUpdatedAt?: string) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      if (lesson) assertCanMutateLesson(user, customRoles, lesson, course, user.id);
      const body: Record<string, unknown> = { action: "publishLesson", lessonId };
      if (baselineUpdatedAt) body.baselineUpdatedAt = baselineUpdatedAt;
      const { status, envelope } = await postModule<any, any>("lessons", body as any, { accessToken });
      if (status === 409) throw new Error("Lesson was modified by another user. Refresh and retry.");
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const archiveLesson = useCallback(
    async (lessonId: string, baselineUpdatedAt?: string) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      if (lesson) assertCanMutateLesson(user, customRoles, lesson, course, user.id);
      const body: Record<string, unknown> = { action: "archiveLesson", lessonId };
      if (baselineUpdatedAt) body.baselineUpdatedAt = baselineUpdatedAt;
      const { status, envelope } = await postModule<any, any>("lessons", body as any, { accessToken });
      if (status === 409) throw new Error("Lesson was modified by another user. Refresh and retry.");
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  // ─── Block Operations ─────────────────────────────────────────────────
  const addBlock = useCallback(
    async (
      lessonId: string,
      block: {
        type: LessonBlockType;
        order: number;
        title?: string;
        body?: string;
        quizData?: unknown;
        assetUrl?: string;
        fileName?: string;
        s3Bucket?: string;
        s3Key?: string;
      }
    ): Promise<LessonBlock | null> => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      assertLessonWriteAccess(user, customRoles, lesson, course, user.id);
      const payload: Record<string, any> = {
        action: "addBlock",
        lessonId,
        type: toApiBlockType(block.type),
        order: block.order,
      };
      if (block.title !== undefined) payload.title = block.title;
      if (block.body !== undefined && block.body !== "") payload.textData = block.body;
      if (block.assetUrl !== undefined && block.assetUrl !== "") payload.assetUrl = block.assetUrl;
      if (block.fileName !== undefined && block.fileName !== "") payload.fileName = block.fileName;
      if (block.s3Bucket !== undefined && block.s3Bucket !== "") payload.s3Bucket = block.s3Bucket;
      if (block.s3Key !== undefined && block.s3Key !== "") payload.s3Key = block.s3Key;
      if (block.type === "quiz" && block.quizData !== undefined) payload.quizData = block.quizData;
      const { envelope } = await postModule<any, any>("lessons", payload, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const mapped = envelope.data ? mapApiBlock(envelope.data) : null;
      await refresh().catch(() => {});
      return mapped;
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const updateBlock = useCallback(
    async (
      lessonId: string,
      blockId: string,
      patch: {
        title?: string;
        order?: number;
        body?: string;
        quizData?: unknown;
        assetUrl?: string;
        fileName?: string;
        s3Bucket?: string;
        s3Key?: string;
      }
    ) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      assertLessonWriteAccess(user, customRoles, lesson, course, user.id);
      const payload: Record<string, any> = { action: "updateBlock", lessonId, blockId };
      if (patch.title !== undefined) payload.title = patch.title;
      if (patch.order !== undefined) payload.order = patch.order;
      if (patch.body !== undefined) payload.textData = patch.body;
      if (patch.assetUrl !== undefined) payload.assetUrl = patch.assetUrl;
      if (patch.fileName !== undefined) payload.fileName = patch.fileName;
      if (patch.s3Bucket !== undefined) payload.s3Bucket = patch.s3Bucket;
      if (patch.s3Key !== undefined) payload.s3Key = patch.s3Key;
      if (patch.quizData !== undefined) payload.quizData = patch.quizData;
      const { envelope } = await postModule<any, any>("lessons", payload, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh().catch(() => {});
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const submitQuiz = useCallback(
    async (lessonId: string, blockId: string, answers: Record<string, string | string[]>) => {
      if (!user) throw new Error("Not authenticated");
      const { envelope } = await postModule<
        { action: "submitQuiz"; lessonId: string; blockId: string; answers: Record<string, string | string[]> },
        LessonQuizSubmitResult
      >("lessons", { action: "submitQuiz", lessonId, blockId, answers }, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const data = envelope.data as LessonQuizSubmitResult & Record<string, unknown>;
      await refresh().catch(() => {});
      return {
        scorePercent: Number(data.scorePercent ?? 0),
        passed: Boolean(data.passed),
        correctCount: Number(data.correctCount ?? 0),
        totalQuestions: Number(data.totalQuestions ?? 0),
        results: Array.isArray(data.results) ? data.results : [],
        progress: data.progress && typeof data.progress === "object" ? (data.progress as Record<string, unknown>) : null,
      };
    },
    [accessToken, refresh, user]
  );

  const removeBlock = useCallback(
    async (lessonId: string, blockId: string) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      assertLessonWriteAccess(user, customRoles, lesson, course, user.id);
      const { envelope } = await postModule<{ action: "removeBlock"; lessonId: string; blockId: string }, any>(
        "lessons",
        { action: "removeBlock", lessonId, blockId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh().catch(() => {});
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  const reorderBlocks = useCallback(
    async (lessonId: string, blockOrder: string[]) => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      assertLessonWriteAccess(user, customRoles, lesson, course, user.id);
      const { envelope } = await postModule<{ action: "reorderBlocks"; lessonId: string; blockOrder: string[] }, any>(
        "lessons",
        { action: "reorderBlocks", lessonId, blockOrder },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh().catch(() => {});
    },
    [accessToken, refresh, user, customRoles, lessons, courses]
  );

  // ─── File Upload ──────────────────────────────────────────────────────
  const getUploadUrl = useCallback(
    async (
      lessonId: string,
      fileName: string,
      contentType: string,
      type: LessonBlockType,
      blockId?: string
    ): Promise<UploadUrlResult> => {
      if (!user) throw new Error("Not authenticated");
      const lesson = lessons.find((l) => l.id === lessonId);
      const course = lesson?.courseId ? courses.find((c) => c.id === lesson.courseId) : undefined;
      assertLessonWriteAccess(user, customRoles, lesson, course, user.id);
      const liveLessons = isLiveLmsHttpEnabled("lessons");
      const payload: Record<string, unknown> = liveLessons
        ? { action: "getUploadUrl", lessonId, fileName }
        : (() => {
            const ct = (contentType && String(contentType).trim()) || guessContentTypeFromFileName(fileName);
            const p: Record<string, unknown> = {
              action: "getUploadUrl",
              lessonId,
              fileName,
              contentType: ct,
              type: toApiBlockType(type),
            };
            if (blockId && !String(blockId).startsWith("new-")) p.blockId = blockId;
            return p;
          })();
      const { envelope } = await postModule<any, UploadUrlResult>("lessons", payload, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      return normalizeUploadUrlPayload(envelope.data);
    },
    [accessToken, user, customRoles, lessons, courses]
  );

  const reorderLessons = useCallback(
    async (courseId: string, lessonIds: string[]) => {
      if (!user) throw new Error("Not authenticated");
      const c = courses.find((x) => x.id === courseId);
      if (c) assertCanEditCourse(user, customRoles, c, user.id);
      await updateCourse(courseId, { lessonOrder: lessonIds });
    },
    [updateCourse, user, customRoles, courses]
  );

  // ─── Enrollments ──────────────────────────────────────────────────────
  const enroll = useCallback(
    async (courseId: string): Promise<Enrollment | null> => {
      if (!user) return null;
      if (isLiveLmsHttpEnabled("enrollments")) {
        throw new Error(
          "Self-enrollment is not supported by the server. Ask an instructor or admin to add you on the course roster."
        );
      }
      const { envelope } = await postModule<{ action: "enrollStudent"; courseId: string }, any>(
        "enrollments",
        { action: "enrollStudent", courseId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
      return {
        id: String(envelope.data?.enrollmentId ?? uid()),
        courseId,
        userId: user.id,
        userName: user.name,
        status: "active",
        enrolledAt: new Date().toISOString(),
      } satisfies Enrollment;
    },
    [accessToken, refresh, user]
  );

  const enrollUserInCourse = useCallback(
    async (courseId: string, targetUserId: string): Promise<Enrollment | null> => {
      if (!user) return null;
      const { envelope } = await postModule<
        { action: "enrollStudent"; courseId: string; userId: string },
        { enrollmentId?: string; userId?: string; userName?: string }
      >("enrollments", { action: "enrollStudent", courseId, userId: targetUserId }, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
      const d = envelope.data ?? {};
      return {
        id: String(d.enrollmentId ?? uid()),
        courseId,
        userId: String(d.userId ?? targetUserId),
        userName: String(d.userName ?? ""),
        status: "active",
        enrolledAt: new Date().toISOString(),
      } satisfies Enrollment;
    },
    [accessToken, refresh, user]
  );

  const deleteEnrollment = useCallback(
    async (courseId: string, userId: string) => {
      const action = getEnrollmentsDeleteAction();
      const { envelope } = await postModule<
        { action: "deleteEnrollment" | "removeEnrollment"; courseId: string; userId: string },
        unknown
      >("enrollments", { action, courseId, userId }, { accessToken });
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, refresh]
  );

  const dropEnrollment = useCallback(
    async (courseId: string) => {
      if (!user) return;
      await deleteEnrollment(courseId, user.id);
    },
    [user, deleteEnrollment]
  );

  const setEnrollmentStatus = useCallback(
    async (enrollmentId: string, status: EnrollmentStatus) => {
      const row = enrollments.find((e) => e.id === enrollmentId);
      if (!row) return;
      const { envelope } = await postModule<any, any>(
        "enrollments",
        { action: "updateEnrollmentStatus", courseId: row.courseId, userId: row.userId, status: status.toUpperCase() },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      await refresh();
    },
    [accessToken, enrollments, refresh]
  );

  // ─── Progress ─────────────────────────────────────────────────────────
  const startLessonProgress = useCallback(
    async (lessonId: string, courseId: string) => {
      const { envelope } = await postModule<{ action: "startLesson"; lessonId: string; courseId: string }, any>(
        "progress",
        { action: "startLesson", lessonId, courseId },
        { accessToken }
      );
      if (!user || isFailure(envelope)) return;
      const mapped = mapApiProgressRowToLessonCompletion(envelope.data, user.id);
      if (mapped) upsertCompletion(mapped);
    },
    [accessToken, user, upsertCompletion]
  );

  const trackLessonProgress = useCallback(
    async (lessonId: string, courseId: string, progress: number) => {
      const { envelope } = await postModule<{ action: "trackProgress"; lessonId: string; courseId: string; progress: number }, any>(
        "progress",
        { action: "trackProgress", lessonId, courseId, progress: Math.round(progress) },
        { accessToken }
      );
      if (!user || isFailure(envelope)) return;
      const mapped = mapApiProgressRowToLessonCompletion(envelope.data, user.id);
      if (mapped) upsertCompletion(mapped);
    },
    [accessToken, user, upsertCompletion]
  );

  const fetchLessonProgress = useCallback(
    async (lessonId: string, opts?: { userId?: string }) => {
      if (!user) return null;
      const body: { action: "getLessonProgress"; lessonId: string; userId?: string } = {
        action: "getLessonProgress",
        lessonId,
      };
      if (opts?.userId) body.userId = opts.userId;
      const { envelope } = await postModule<typeof body, unknown>("progress", body, { accessToken });
      if (isFailure(envelope)) return null;
      const mapped = mapApiProgressRowToLessonCompletion(envelope.data, user.id);
      if (mapped) upsertCompletion(mapped);
      return mapped;
    },
    [accessToken, user, upsertCompletion]
  );

  const markLessonComplete = useCallback(
    async (courseId: string, lessonId: string) => {
      if (!user) return;
      const { envelope } = await postModule<{ action: "completeLesson"; lessonId: string; courseId: string }, any>(
        "progress",
        { action: "completeLesson", lessonId, courseId },
        { accessToken }
      );
      if (isFailure(envelope)) throw new Error(getEnvelopeError(envelope));
      const mapped = mapApiProgressRowToLessonCompletion(envelope.data, user.id);
      if (mapped) upsertCompletion(mapped);
      await refresh();
    },
    [accessToken, refresh, user, upsertCompletion]
  );

  const getCompletedLessonIds = useCallback(
    (userId: string, courseId: string) => {
      const ids = new Set<string>();
      completions.forEach((c) => {
        if (c.userId === userId && c.courseId === courseId && c.completed) ids.add(c.lessonId);
      });
      return ids;
    },
    [completions]
  );

  const getCourseProgressPercent = useCallback(
    (userId: string, courseId: string) => {
      const list = lessons.filter((l) => l.courseId === courseId && !l.deleted);
      if (list.length === 0) return 0;
      const done = getCompletedLessonIds(userId, courseId);
      let n = 0;
      list.forEach((l) => {
        if (done.has(l.id)) n++;
      });
      return Math.round((n / list.length) * 100);
    },
    [getCompletedLessonIds, lessons]
  );

  const isLessonLocked = useCallback(
    (userId: string, course: Course, lesson: Lesson) => {
      if (lesson.locked) return true;
      if (!lesson.sequential) return false;
      const order = course.lessonOrder.filter((id) => {
        const le = lessons.find((x) => x.id === id);
        return le && !le.deleted;
      });
      const idx = order.indexOf(lesson.id);
      if (idx <= 0) return false;
      const prevId = order[idx - 1];
      return !getCompletedLessonIds(userId, course.id).has(prevId);
    },
    [getCompletedLessonIds, lessons]
  );

  // ─── History ──────────────────────────────────────────────────────────
  const fetchLessonHistory = useCallback(
    async (lessonId: string, limit = 50): Promise<LessonVersionSnapshot[]> => {
      const lim = Math.min(100, Math.max(1, Math.floor(limit)));
      const { envelope } = await postModule<{ action: "getLessonHistory"; lessonId: string; limit: number }, any>(
        "lessons",
        { action: "getLessonHistory", lessonId, limit: lim },
        { accessToken }
      );
      if (isFailure(envelope)) return [];
      const history = Array.isArray(envelope.data?.history) ? envelope.data.history : [];
      const mapped: LessonVersionSnapshot[] = history.map((h: any) => ({
        version: Number(h.version ?? 0),
        savedAt: String(h.savedAt ?? ""),
        savedBy: String(h.savedBy ?? ""),
        lesson: h.snapshot ?? {},
      }));
      setHistoryCache((prev) => ({ ...prev, [lessonId]: mapped }));
      return mapped;
    },
    [accessToken]
  );

  const getLessonHistory = useCallback(
    (lessonId: string) => historyCache[lessonId] ?? [],
    [historyCache]
  );

  const fetchCourseProgressSummary = useCallback(
    async (courseId: string): Promise<CourseProgressSummary | null> => {
      const { envelope } = await postModule<{ action: "getCourseProgressSummary"; courseId: string }, any>(
        "progress",
        { action: "getCourseProgressSummary", courseId },
        { accessToken }
      );
      if (isFailure(envelope)) return null;
      return envelope.data as CourseProgressSummary;
    },
    [accessToken]
  );

  // ─── Stale checks ────────────────────────────────────────────────────
  const checkStaleCourse = useCallback(
    (courseId: string, baselineUpdatedAt: string) => {
      const c = courses.find((x) => x.id === courseId);
      if (!c) return false;
      return c.updatedAt !== baselineUpdatedAt;
    },
    [courses]
  );

  const checkStaleLesson = useCallback(
    (lessonId: string, baselineUpdatedAt: string) => {
      const l = lessons.find((x) => x.id === lessonId);
      if (!l) return false;
      return l.updatedAt !== baselineUpdatedAt;
    },
    [lessons]
  );

  const value = useMemo<LmsContextValue>(
    () => ({
      courses,
      lessons,
      enrollments,
      completions,
      loading,
      error,
      lastMutationAt,
      refresh,
      getCourse,
      getLessonsForCourse,
      getLesson,
      fetchLesson,
      getEnrollment,
      isEnrolled,
      createCourse,
      updateCourse,
      deleteCourse,
      publishCourse,
      archiveCourse,
      assignTeacher,
      removeTeacher,
      createLesson,
      createStandaloneLesson,
      attachLessonToCourse,
      detachLessonFromCourse,
      getStandaloneLessons,
      updateLesson,
      deleteLesson,
      publishLesson,
      archiveLesson,
      addBlock,
      updateBlock,
      submitQuiz,
      removeBlock,
      reorderBlocks,
      getUploadUrl,
      reorderLessons,
      enroll,
      enrollUserInCourse,
      deleteEnrollment,
      dropEnrollment,
      setEnrollmentStatus,
      markLessonComplete,
      startLessonProgress,
      trackLessonProgress,
      fetchLessonProgress,
      getCourseProgressPercent,
      getCompletedLessonIds,
      isLessonLocked,
      fetchLessonHistory,
      getLessonHistory,
      fetchCourseProgressSummary,
      checkStaleCourse,
      checkStaleLesson,
    }),
    [
      courses, lessons, enrollments, completions, loading, error, lastMutationAt,
      refresh, getCourse, getLessonsForCourse, getLesson, fetchLesson, getEnrollment, isEnrolled,
      createCourse, updateCourse, deleteCourse, publishCourse, archiveCourse, assignTeacher, removeTeacher,
      createLesson, createStandaloneLesson, attachLessonToCourse, detachLessonFromCourse, getStandaloneLessons,
      updateLesson, deleteLesson, publishLesson, archiveLesson,
      addBlock, updateBlock, submitQuiz, removeBlock, reorderBlocks, getUploadUrl,
      reorderLessons, enroll, enrollUserInCourse, deleteEnrollment, dropEnrollment, setEnrollmentStatus,
      markLessonComplete, startLessonProgress, trackLessonProgress, fetchLessonProgress,
      getCourseProgressPercent, getCompletedLessonIds, isLessonLocked,
      fetchLessonHistory, getLessonHistory, fetchCourseProgressSummary,
      checkStaleCourse, checkStaleLesson,
    ]
  );

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export function useLms() {
  const ctx = useContext(LmsContext);
  if (!ctx) throw new Error("useLms must be used within LmsProvider");
  return ctx;
}
