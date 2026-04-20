import { describe, expect, it } from "vitest";
import { mapApiProgressRowToLessonCompletion } from "./lmsProgressNormalize";

describe("mapApiProgressRowToLessonCompletion", () => {
  it("returns null for getLessonProgress empty state (§7.4)", () => {
    expect(
      mapApiProgressRowToLessonCompletion(
        {
          userId: "u1",
          lessonId: "L1",
          courseId: "C1",
          progress: 0,
          completed: false,
          lastViewedAt: null,
          lastActivityAt: null,
          completedAt: null,
        },
        "u1"
      )
    ).toBeNull();
  });

  it("maps a progress row with lastViewedAt", () => {
    const row = mapApiProgressRowToLessonCompletion(
      {
        userId: "u1",
        lessonId: "L1",
        courseId: "C1",
        progress: 72,
        completed: false,
        lastViewedAt: "2026-01-01T00:00:00.000Z",
        lastActivityAt: "2026-01-01T00:00:00.000Z",
        completedAt: null,
      },
      "u1"
    );
    expect(row?.progressPercent).toBe(72);
    expect(row?.completed).toBe(false);
    expect(row?.lastActivityAt).toContain("2026");
  });
});
