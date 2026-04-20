import { describe, expect, it } from "vitest";
import { extractGetStudentProgressRows, extractListItems } from "./lmsListExtract";

describe("extractListItems", () => {
  it("returns arrays as-is", () => {
    expect(extractListItems([{ id: "1" }])).toEqual([{ id: "1" }]);
  });

  it("unwraps common keys", () => {
    expect(extractListItems({ lessons: [{ lessonId: "a" }] })).toEqual([{ lessonId: "a" }]);
    expect(extractListItems({ courses: [{ courseId: "c" }] })).toEqual([{ courseId: "c" }]);
    expect(extractListItems({ items: [1, 2] })).toEqual([1, 2]);
  });

  it("unwraps nested data.result", () => {
    expect(
      extractListItems({
        data: { result: { lessons: [{ lessonId: "x" }] } },
      })
    ).toEqual([{ lessonId: "x" }]);
  });

  it("returns single row objects that look like entities", () => {
    const one = { lessonId: "L1", title: "Hi" };
    expect(extractListItems(one)).toEqual([one]);
  });

  it("returns empty for empty input", () => {
    expect(extractListItems(null)).toEqual([]);
    expect(extractListItems({})).toEqual([]);
  });
});

describe("extractGetStudentProgressRows", () => {
  it("returns arrays as-is", () => {
    expect(extractGetStudentProgressRows([{ lessonId: "a" }])).toEqual([{ lessonId: "a" }]);
  });

  it("unwraps { progress: [...] }", () => {
    expect(
      extractGetStudentProgressRows({
        userId: "u1",
        progress: [{ lessonId: "L1", courseId: "C1" }],
      })
    ).toEqual([{ lessonId: "L1", courseId: "C1" }]);
  });
});
