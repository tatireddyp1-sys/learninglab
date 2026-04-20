/**
 * Normalize list payloads from LMS POST /courses and POST /lessons (action-based).
 * Gateways often nest arrays under `data.result.lessons`, `items`, etc.
 */

import { isLmsApiDebugEnabled, type LearningLabEnvelope } from "@/lib/learningLabApi";

const NEST_KEYS = ["data", "result", "payload", "body", "response", "content"] as const;
const ARRAY_KEYS = [
  "lessons",
  "courses",
  "items",
  "results",
  "rows",
  "records",
  "list",
  "elements",
  "values",
] as const;

/**
 * Extract an array of row objects from a module `data` field (or nested shapes).
 */
export function extractListItems(payload: unknown, depth = 0): unknown[] {
  if (depth > 10) return [];
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return [];

  const o = payload as Record<string, unknown>;

  for (const key of ARRAY_KEYS) {
    const v = o[key];
    if (Array.isArray(v)) return v;
  }

  for (const key of NEST_KEYS) {
    const v = o[key];
    if (v != null && typeof v === "object") {
      const inner = extractListItems(v, depth + 1);
      if (inner.length > 0) return inner;
    }
  }

  const values = Object.values(o);
  const firstArray = values.find((v) => Array.isArray(v));
  if (Array.isArray(firstArray)) return firstArray;

  if (
    o.lessonId != null ||
    o.courseId != null ||
    (o.id != null && (o.title != null || o.name != null || o.email != null))
  ) {
    return [o];
  }

  return [];
}

/**
 * `getStudentProgress` may return a bare array (roster / tenant list) or `{ userId, progress: [...] }` (self scope).
 */
export function extractGetStudentProgressRows(data: unknown): unknown[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.progress)) return o.progress;
  return extractListItems(data);
}

export function debugLmsListResponse(
  label: string,
  action: string,
  httpStatus: number,
  envelope: LearningLabEnvelope<unknown>,
  extractedRows: unknown[]
): void {
  if (!isLmsApiDebugEnabled()) return;

  const ok = envelope.success === true;
  const data = ok ? (envelope as { data?: unknown }).data : undefined;
  const dataKeys =
    data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data as object).join(", ") : typeof data;

  const sample =
    extractedRows[0] && typeof extractedRows[0] === "object"
      ? Object.keys(extractedRows[0] as object).join(", ")
      : "—";

  console.info(
    `[LMS list] ${label} action=${action} http=${httpStatus} envelopeOk=${ok} extractedCount=${extractedRows.length} dataKeys=[${dataKeys}] firstRowKeys=[${sample}]`
  );

  if (ok && extractedRows.length === 0 && data != null) {
    try {
      const s = JSON.stringify(data);
      console.warn(`[LMS list] ${label} — 0 rows after extract. Raw data (truncated):`, s.length > 1200 ? `${s.slice(0, 1200)}…` : s);
    } catch {
      console.warn(`[LMS list] ${label} — 0 rows; could not stringify data`);
    }
  }

  if (!ok) {
    const msg = (envelope as { message?: string }).message ?? "error";
    console.warn(`[LMS list] ${label} action=${action} failed:`, msg);
  }
}
