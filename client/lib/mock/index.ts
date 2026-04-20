/**
 * Mock API router — dispatches postModule calls to in-browser service handlers.
 *
 * This is the single entry point that replaces real HTTP calls.
 * Each module maps to a handler that reads/writes localStorage.
 *
 * ► To migrate to a real backend: delete the `mock/` folder and restore
 *   the fetch-based `postModule` in `learningLabApi.ts`.
 */

import type { LearningLabModule, LearningLabEnvelope } from "@/lib/learningLabApi";
import * as sessionTokens from "@/lib/sessionTokens";
import { resetAllData } from "@/lib/mockStorage";
import { delay } from "./delay";
import { ensureSeedData } from "./seedData";
import { handleAuth } from "./authService";
import { handleAdmin } from "./adminService";
import { handleCourses } from "./coursesService";
import { handleLessons } from "./lessonsService";
import { handleEnrollments } from "./enrollmentsService";
import { handleProgress } from "./progressService";

let seeded = false;

/** Clears persisted mock data and allows a fresh seed on next API call — for Vitest only. */
export function resetMockApiForTests(): void {
  seeded = false;
  resetAllData();
}

type MockResult = { status: number; envelope: LearningLabEnvelope<any> };
type Handler = (body: any, token: string | null) => Promise<MockResult>;

const handlers: Record<LearningLabModule, Handler> = {
  auth: handleAuth,
  admin: handleAdmin,
  courses: handleCourses,
  lessons: handleLessons,
  enrollments: handleEnrollments,
  progress: handleProgress,
};

/**
 * Drop-in replacement for the fetch-based `postModule`.
 * Signature matches so existing contexts/pages need zero changes.
 */
export async function mockPostModule<ActionReq extends { action: string }, ResData>(
  module: LearningLabModule,
  body: ActionReq,
  opts?: { accessToken?: string | null }
): Promise<{ status: number; envelope: LearningLabEnvelope<ResData> }> {
  if (!seeded) {
    ensureSeedData();
    seeded = true;
  }

  await delay();

  const token = opts?.accessToken ?? sessionTokens.getAccessToken();
  const handler = handlers[module];
  if (!handler) {
    return {
      status: 400,
      envelope: { success: false, message: `Unknown module: ${module}` },
    };
  }

  try {
    const result = await handler(body, token);
    return result as { status: number; envelope: LearningLabEnvelope<ResData> };
  } catch (err: any) {
    return {
      status: 500,
      envelope: { success: false, message: err?.message ?? "Internal mock error" },
    };
  }
}

