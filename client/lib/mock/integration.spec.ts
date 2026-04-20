/**
 * Integrated mock-API checks across roles (student / teacher / admin).
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getEnvelopeError, isFailure } from "@/lib/learningLabApi";
import { configureMockDelay } from "./delay";
import { mockPostModule, resetMockApiForTests } from "./index";

async function signin(email: string, password: string): Promise<string> {
  const { envelope } = await mockPostModule<any, any>(
    "auth",
    { action: "signin", email, password, tenantId: "t1" },
    {}
  );
  expect(envelope.success).toBe(true);
  const t = envelope.data?.accessToken as string;
  expect(t).toBeTruthy();
  return t;
}

beforeEach(() => {
  configureMockDelay({ min: 0, max: 0 });
  resetMockApiForTests();
});

describe("mock LMS — auth & errors", () => {
  it("rejects bad password", async () => {
    const { envelope } = await mockPostModule<any, any>(
      "auth",
      { action: "signin", email: "alex@student.edu", password: "wrong", tenantId: "t1" },
      {}
    );
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/invalid/i);
  });

  it("admin can sign in", async () => {
    await signin("admin@learninglab.com", "password123");
  });
});

describe("mock LMS — lessons visibility by role", () => {
  it("student listAllLessons only returns lessons for enrolled courses", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "lessons",
      { action: "listAllLessons" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
    const lessons = (envelope.data?.lessons ?? []) as { courseId: string }[];
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((l) => l.courseId === "crs_001" || l.courseId === "crs_002")).toBe(true);
  });

  it("teacher listAllLessons returns more lessons than student (includes other courses)", async () => {
    const studentTok = await signin("alex@student.edu", "password123");
    const teacherTok = await signin("prof.smith@learninglab.com", "password123");
    const s = await mockPostModule<any, any>("lessons", { action: "listAllLessons" }, { accessToken: studentTok });
    const th = await mockPostModule<any, any>("lessons", { action: "listAllLessons" }, { accessToken: teacherTok });
    expect(s.envelope.success && th.envelope.success).toBe(true);
    const nS = (s.envelope.data?.lessons ?? []).length;
    const nT = (th.envelope.data?.lessons ?? []).length;
    expect(nT).toBeGreaterThanOrEqual(nS);
  });

  it("unauthenticated listAllLessons fails", async () => {
    const { envelope } = await mockPostModule<any, any>("lessons", { action: "listAllLessons" }, {});
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/authentication/i);
  });
});

describe("mock LMS — getLesson", () => {
  it("teacher getLesson returns lesson row with lessonId", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "lessons",
      { action: "getLesson", lessonId: "les_001" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
    expect((envelope as { data?: { lessonId?: string } }).data?.lessonId).toBe("les_001");
  });
});

describe("mock LMS — student cannot mutate curriculum", () => {
  it("student cannot createLesson", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "lessons",
      { action: "createLesson", title: "Hacked" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/permission/i);
  });

  it("student cannot attachLessonToCourse", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "lessons",
      { action: "attachLessonToCourse", lessonId: "les_001", courseId: "crs_002" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
  });

  it("student cannot getUploadUrl", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "lessons",
      { action: "getUploadUrl", lessonId: "les_001", fileName: "x.pdf" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
  });

  it("student cannot createCourse", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "courses",
      { action: "createCourse", title: "Free degree" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/permission/i);
  });
});

describe("mock LMS — create lesson and all block types", () => {
  it("teacher can create a lesson on an owned course and add TEXT, VIDEO, DOCUMENT, IMAGE, QUIZ blocks", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope: createEnv } = await mockPostModule<any, any>(
      "lessons",
      {
        action: "createLesson",
        courseId: "crs_003",
        title: "Block type probe",
        lessonOrder: 2,
        description: "Integration test lesson",
        sequential: true,
      },
      { accessToken: t }
    );
    expect(createEnv.success).toBe(true);
    const lessonId = (createEnv.data as { lessonId?: string })?.lessonId;
    expect(lessonId).toBeTruthy();

    const variants: Array<{
      type: string;
      extra?: Record<string, unknown>;
    }> = [
      { type: "TEXT", extra: { textData: "Hello" } },
      { type: "VIDEO", extra: { assetUrl: "https://example.com/v.mp4", fileName: "v.mp4" } },
      { type: "DOCUMENT", extra: { assetUrl: "https://example.com/d.pdf", fileName: "d.pdf" } },
      { type: "IMAGE", extra: { assetUrl: "https://example.com/i.png", fileName: "i.png" } },
      { type: "QUIZ", extra: { textData: "{}" } },
    ];

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const { envelope } = await mockPostModule<any, any>(
        "lessons",
        {
          action: "addBlock",
          lessonId,
          type: v.type,
          order: i,
          title: `${v.type} block`,
          ...v.extra,
        },
        { accessToken: t }
      );
      expect(envelope.success).toBe(true);
    }
  });
});

describe("mock LMS — progress enrollment gate", () => {
  it("student cannot completeLesson in a course they are not enrolled in", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "progress",
      { action: "completeLesson", lessonId: "les_006", courseId: "crs_003" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/enrolled/i);
  });

  it("student can completeLesson in an enrolled course", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "progress",
      { action: "completeLesson", lessonId: "les_003", courseId: "crs_001" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
  });

  it("teacher can completeLesson without being enrolled (instructional override)", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "progress",
      { action: "completeLesson", lessonId: "les_006", courseId: "crs_003" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
  });
});

describe("mock LMS — analytics", () => {
  it("student cannot fetch course progress summary", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "progress",
      { action: "getCourseProgressSummary", courseId: "crs_001" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/instructors|administrators/i);
  });

  it("teacher can fetch course progress summary", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "progress",
      { action: "getCourseProgressSummary", courseId: "crs_001" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
  });
});

describe("mock LMS — enrollments list scope", () => {
  it("student listStudentEnrollments is scoped to self", async () => {
    const t = await signin("alex@student.edu", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "enrollments",
      { action: "listStudentEnrollments" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
    const rows = envelope.data as unknown[];
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as { userId: string }[]).every((e) => e.userId === "usr_student_001")).toBe(true);
  });

  it("teacher listStudentEnrollments returns all rows", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "enrollments",
      { action: "listStudentEnrollments" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
    const rows = envelope.data as unknown[];
    expect(rows.length).toBeGreaterThan(3);
  });

  it("course owner can enroll another teacher in their course", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "enrollments",
      { action: "enrollStudent", courseId: "crs_001", userId: "usr_teacher_002" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
    expect((envelope.data as any)?.userId).toBe("usr_teacher_002");
  });

  it("teacher cannot enroll users in another teacher’s course", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "enrollments",
      { action: "enrollStudent", courseId: "crs_002", userId: "usr_student_002" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(false);
    expect(isFailure(envelope) && getEnvelopeError(envelope)).toMatch(/manage/i);
  });

  it("course owner can enroll a student via roster action", async () => {
    const t = await signin("dr.jones@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "enrollments",
      { action: "enrollStudent", courseId: "crs_002", userId: "usr_student_002" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
  });

  it("teacher can self-enroll in a colleague’s published course", async () => {
    const t = await signin("prof.smith@learninglab.com", "password123");
    const { envelope } = await mockPostModule<any, any>(
      "enrollments",
      { action: "enrollStudent", courseId: "crs_002" },
      { accessToken: t }
    );
    expect(envelope.success).toBe(true);
    expect((envelope.data as any)?.userId).toBeTruthy();
  });
});
