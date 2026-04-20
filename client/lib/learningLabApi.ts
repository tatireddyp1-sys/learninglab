/**
 * Learning Lab API — action-based POST per module.
 *
 * Base URL is `VITE_LMS_API_BASE_URL` (e.g. `https://….amazonaws.com/v1`). Each module is POST `{base}/{module}`:
 * - Admin: `POST {base}/admin`
 * - Auth: `POST …/v1/auth`
 *
 * - When the base URL is set, `auth`, `admin`, `courses`, and `lessons` use live HTTP (unless mock flags below).
 *   Lessons module actions: createLesson, updateLesson, attachLessonToCourse, detachLessonFromCourse, publishLesson,
 *   archiveLesson, deleteLesson, addBlock, updateBlock, removeBlock, reorderBlocks, getLesson, listLessons, getLessonHistory,
 *   getUploadUrl, submitQuiz.
 * - `progress` follows the same rule as other modules: POST `…/v1/progress` when the base URL is set.
 * - `VITE_LMS_API_MOCK_PROGRESS=true` forces in-browser mock progress even when the base URL is set.
 * - `enrollments` uses HTTP when the base URL is set (same POST pattern as COURSES). Failures may use top-level `message` (ENROLLMENTS contract).
 * - Dropping a user: `VITE_LMS_ENROLLMENTS_DELETE_ACTION` = `deleteEnrollment` (default) or `removeEnrollment` to match the deployed Lambda action name.
 * - `VITE_LMS_API_MOCK_AUTH_ADMIN=true` forces mock for auth + admin even when the base URL is set.
 * - `VITE_LMS_API_MOCK_COURSES_LESSONS=true` forces mock for courses + lessons only.
 * - `VITE_LMS_API_MOCK_ENROLLMENTS=true` forces mock for enrollments only.
 *
 * Live HTTP: on **401** only (e.g. expired bearer), if a refresh token is stored, calls `POST …/auth`
 * `{ action: "refresh", refreshToken }`, updates the global access token, then retries the original request once.
 * **403** is never retried — permission/forbidden errors surface immediately to callers.
 */

import { extractAccessToken, extractRefreshTokenOptional } from "@/lib/authEnvelopeParse";
import { mockPostModule } from "@/lib/mock/index";
import * as sessionTokens from "@/lib/sessionTokens";

export type LearningLabModule =
  | "auth"
  | "admin"
  | "courses"
  | "lessons"
  | "enrollments"
  | "progress";

export type LearningLabSuccess<T> = { success: true; data: T };
export type LearningLabFailure = {
  success: false;
  message?: string;
  data?: string;
  error?: { code?: string; message?: string };
};
export type LearningLabEnvelope<T> = LearningLabSuccess<T> | LearningLabFailure;

export function isFailure<T>(env: LearningLabEnvelope<T>): env is LearningLabFailure {
  return env.success === false;
}

export function getEnvelopeError(env: LearningLabEnvelope<any>): string {
  if (!isFailure(env)) return "Request failed";
  return env.error?.message ?? env.message ?? env.data ?? "Request failed";
}

export function getLmsApiBaseUrl(): string | undefined {
  const raw = import.meta.env.VITE_LMS_API_BASE_URL as string | undefined;
  if (raw && String(raw).trim()) return String(raw).replace(/\/$/, "");
  return undefined;
}

/** POST body `action` for unenroll (`courseId` + `userId`). Mock accepts both. */
export function getEnrollmentsDeleteAction(): "deleteEnrollment" | "removeEnrollment" {
  const raw = (import.meta.env.VITE_LMS_ENROLLMENTS_DELETE_ACTION as string | undefined)?.trim().toLowerCase();
  if (raw === "removeenrollment" || raw === "remove") return "removeEnrollment";
  return "deleteEnrollment";
}

/** Resolved `POST` URL for a module, e.g. admin → `https://host/v1/admin`. Undefined if no base URL. */
export function getLmsModuleUrl(module: LearningLabModule): string | undefined {
  const base = getLmsApiBaseUrl();
  if (!base) return undefined;
  return joinBaseAndModule(base, module);
}

/** True when signin/admin hit the real API (HTTP). False = in-browser mock, no `fetch` — Network tab stays empty. */
export function isLiveLmsHttpEnabled(module: LearningLabModule): boolean {
  const base = getLmsApiBaseUrl();
  if (!base || forceMockAuthAdmin()) return false;
  return useLiveHttpFor(module);
}

/** When true, auth/admin also use the mock (e2e / offline). */
function forceMockAuthAdmin(): boolean {
  return import.meta.env.VITE_LMS_API_MOCK_AUTH_ADMIN === "true";
}

function forceMockCoursesLessons(): boolean {
  return import.meta.env.VITE_LMS_API_MOCK_COURSES_LESSONS === "true";
}

function forceMockEnrollments(): boolean {
  return import.meta.env.VITE_LMS_API_MOCK_ENROLLMENTS === "true";
}

function forceMockProgress(): boolean {
  return import.meta.env.VITE_LMS_API_MOCK_PROGRESS === "true";
}

function useLiveHttpFor(module: LearningLabModule): boolean {
  if (!getLmsApiBaseUrl() || forceMockAuthAdmin()) return false;
  if (module === "progress") {
    if (forceMockProgress()) return false;
    return true;
  }
  if (module === "enrollments" && forceMockEnrollments()) return false;
  if ((module === "courses" || module === "lessons") && forceMockCoursesLessons()) return false;
  return true;
}

export type PostModuleOpts = {
  accessToken?: string | null;
  /** @internal skip 401 → refresh → retry (used after one refresh attempt). */
  __skipTokenRefresh?: boolean;
};

function resolveBearerToken(opts?: PostModuleOpts): string | null {
  return opts?.accessToken ?? sessionTokens.getAccessToken();
}

/** When true, logs list extraction + envelope hints for courses/lessons refresh (browser console). */
export function isLmsApiDebugEnabled(): boolean {
  return import.meta.env.VITE_LMS_API_DEBUG === "true";
}

function isApiDebugEnabled(): boolean {
  return isLmsApiDebugEnabled();
}

function logApiRouting(
  mode: "http" | "mock",
  module: LearningLabModule,
  body: Record<string, unknown> & { action?: string },
  url?: string
): void {
  if (!isApiDebugEnabled()) return;
  if (mode === "http" && url) {
    console.info(`[LearningLab API] HTTP ${module} → ${url}`, body);
  } else {
    console.info(`[LearningLab API] MOCK ${module}`, body);
  }
}

/** Join API base (`/v1` or `https://host/v1`) with module name (`auth`, `admin`, …). */
function joinBaseAndModule(baseUrl: string, module: LearningLabModule): string {
  const b = baseUrl.replace(/\/$/, "");
  return `${b}/${module}`;
}

function envelopeFromJson<ResData>(status: number, json: Record<string, unknown>): LearningLabEnvelope<ResData> {
  const successFlag = json.success === true || json.Success === true;
  const failureFlag = json.success === false || json.Success === false;

  if (failureFlag) {
    const err = json.error as { code?: string; message?: string } | undefined;
    const message = err?.message ?? (json.message as string) ?? "Request failed";
    return {
      success: false,
      message,
      error: err ? { code: err.code, message: err.message ?? message } : { message },
    };
  }

  if (successFlag) {
    let data = json.data !== undefined ? json.data : (json as { Data?: unknown }).Data;
    if (data === undefined && json.result !== undefined) data = json.result;
    if (data === undefined) data = {} as ResData;
    return { success: true, data: data as ResData };
  }

  if (status >= 200 && status < 300 && !failureFlag) {
    const data = json.data !== undefined ? json.data : json;
    return { success: true, data: data as ResData };
  }

  if (!successFlag && (status < 200 || status >= 300)) {
    const errObj =
      json.error && typeof json.error === "object"
        ? (json.error as { message?: string; code?: string })
        : undefined;
    const message =
      errObj?.message ??
      (json.message as string | undefined) ??
      `Request failed (${status})`;
    return {
      success: false,
      message,
      error: errObj?.code || errObj?.message ? { code: errObj?.code, message } : { message },
    };
  }

  return {
    success: false,
    message: "Invalid API response: expected success envelope with data",
  };
}

async function fetchPostModule<ActionReq extends { action: string }, ResData>(
  baseUrl: string,
  module: LearningLabModule,
  body: ActionReq,
  opts?: PostModuleOpts
): Promise<{ status: number; envelope: LearningLabEnvelope<ResData> }> {
  const token = resolveBearerToken(opts);
  const url = joinBaseAndModule(baseUrl, module);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const status = res.status;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return {
      status,
      envelope: {
        success: false,
        message: text || `Non-JSON response from ${url}`,
      },
    };
  }

  const json = (await res.json()) as Record<string, unknown>;
  return { status, envelope: envelopeFromJson<ResData>(status, json) };
}

async function refreshSessionWithStoredTokenImpl(): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const rt = sessionTokens.getRefreshToken();
  if (!rt) return { ok: false };

  const base = getLmsApiBaseUrl();
  if (!base || !isLiveLmsHttpEnabled("auth")) {
    const { envelope } = await mockPostModule(
      "auth",
      { action: "refresh", refreshToken: rt } as { action: string; refreshToken: string },
      {}
    );
    if (!envelope.success) return { ok: false };
    try {
      const access = extractAccessToken(envelope.data);
      sessionTokens.setAccessToken(access);
      const nr = extractRefreshTokenOptional(envelope.data);
      if (nr) sessionTokens.setRefreshToken(nr);
      return { ok: true, data: envelope.data };
    } catch {
      return { ok: false };
    }
  }

  const url = joinBaseAndModule(base, "auth");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", refreshToken: rt }),
  });
  const status = res.status;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return { ok: false };
  const json = (await res.json()) as Record<string, unknown>;
  const envelope = envelopeFromJson(status, json);
  if (!envelope.success) return { ok: false };
  try {
    const access = extractAccessToken(envelope.data);
    sessionTokens.setAccessToken(access);
    const nr = extractRefreshTokenOptional(envelope.data);
    if (nr) sessionTokens.setRefreshToken(nr);
    return { ok: true, data: envelope.data };
  } catch {
    return { ok: false };
  }
}

let refreshFlight: Promise<{ ok: true; data: unknown } | { ok: false }> | null = null;

/**
 * Uses stored refresh token; updates global access (and refresh if returned). Deduplicated when many requests fail at once.
 * Used on app load (AuthProvider) and after 401 on live module calls.
 */
export async function refreshSessionWithStoredToken(): Promise<{ ok: true; data: unknown } | { ok: false }> {
  if (!refreshFlight) {
    refreshFlight = refreshSessionWithStoredTokenImpl().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}

function shouldAttemptTokenRefresh(
  status: number,
  module: LearningLabModule,
  body: { action?: string },
  opts?: PostModuleOpts
): boolean {
  if (opts?.__skipTokenRefresh) return false;
  if (module === "auth") return false;
  if (body.action === "refresh") return false;
  if (!sessionTokens.getRefreshToken()) return false;
  return status === 401;
}

export async function postModule<ActionReq extends { action: string }, ResData>(
  module: LearningLabModule,
  body: ActionReq,
  opts?: PostModuleOpts
): Promise<{ status: number; envelope: LearningLabEnvelope<ResData> }> {
  const base = getLmsApiBaseUrl();
  const live = !!(base && useLiveHttpFor(module));
  if (live) {
    const url = getLmsModuleUrl(module) ?? joinBaseAndModule(base!, module);
    logApiRouting("http", module, body as Record<string, unknown> & { action?: string }, url);
    let result = await fetchPostModule<ActionReq, ResData>(base!, module, body, opts);
    if (shouldAttemptTokenRefresh(result.status, module, body as { action?: string }, opts)) {
      const refreshed = await refreshSessionWithStoredToken();
      if (refreshed.ok) {
        result = await fetchPostModule<ActionReq, ResData>(base!, module, body, {
          ...opts,
          __skipTokenRefresh: true,
        });
      }
    }
    return result;
  }
  logApiRouting("mock", module, body as Record<string, unknown> & { action?: string });
  return mockPostModule<ActionReq, ResData>(module, body, opts);
}
