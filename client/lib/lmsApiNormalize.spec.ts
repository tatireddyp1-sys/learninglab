import { describe, it, expect } from "vitest";
import { extractLessonIdFromEnvelope, normalizeApiEnrollmentRow, normalizeApiLesson } from "./lmsApiNormalize";

describe("normalizeApiLesson", () => {
  it("maps API status DELETED and isDeleted to deleted", () => {
    const now = new Date().toISOString();
    const a = normalizeApiLesson(
      { lessonId: "L1", courseId: "C1", title: "t", status: "DELETED", createdAt: now, updatedAt: now },
      "u1",
      now
    );
    expect(a.deleted).toBe(true);
    const b = normalizeApiLesson(
      { lessonId: "L2", courseId: "C1", title: "t", isDeleted: true, createdAt: now, updatedAt: now },
      "u1",
      now
    );
    expect(b.deleted).toBe(true);
  });
});

describe("normalizeApiEnrollmentRow", () => {
  it("maps ENROLLMENTS API uppercase status", () => {
    const now = new Date().toISOString();
    const a = normalizeApiEnrollmentRow(
      { courseId: "C1", userId: "U1", status: "SUSPENDED", enrolledAt: now },
      "U1",
      now
    );
    expect(a.status).toBe("suspended");
    const b = normalizeApiEnrollmentRow(
      { courseId: "C1", userId: "U1", status: "ACTIVE", enrolledAt: now },
      "U1",
      now
    );
    expect(b.status).toBe("active");
  });
});

describe("extractLessonIdFromEnvelope", () => {
  it("reads flat lessonId", () => {
    expect(extractLessonIdFromEnvelope({ lessonId: "les_abc" })).toBe("les_abc");
  });
  it("reads nested lesson.lessonId", () => {
    expect(extractLessonIdFromEnvelope({ lesson: { lessonId: "les_nested" } })).toBe("les_nested");
  });
  it("reads nested lesson.id", () => {
    expect(extractLessonIdFromEnvelope({ lesson: { id: "les_x" } })).toBe("les_x");
  });
  it("returns empty for missing", () => {
    expect(extractLessonIdFromEnvelope({})).toBe("");
    expect(extractLessonIdFromEnvelope(null)).toBe("");
  });
});
