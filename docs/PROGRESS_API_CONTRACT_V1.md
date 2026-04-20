# PROGRESS & ANALYTICS API CONTRACT (v1)

## 1. Overview

This contract documents every action implemented in the **PROGRESS** module. The Learning Lab SPA uses these actions for:

- **Learner flow**: record lesson start, scroll/view progress, mark lesson complete (drives sequential unlock and course completion %).
- **Refresh / dashboards**: load the caller’s completion rows; instructors/admins load **per-course analytics** (aggregates + per-student breakdown).
- **Cross-module behavior**: progress updates assume valid **course**, **lesson**, and (for learners) **enrollment** data maintained by COURSES, LESSONS, and ENROLLMENTS modules.

Implemented actions:

1. `getStudentProgress` — list lesson-level progress rows for the current user (or all rows for admin/teacher per rules below).
2. `startLesson` — idempotent “session start” for a lesson within a course (creates progress row if missing).
3. `trackProgress` — update 0–100% progress for a lesson (may auto-mark complete at 100%).
4. `completeLesson` — force lesson complete (100%); may trigger course-level completion side effects.
5. `getCourseProgressSummary` — analytics for one course (instructors/admins).

**Not in this module** (other routes):

- `submitQuiz` and quiz grading live under **LESSONS** (`POST /v1/lessons`). The UI may call `trackProgress` / `completeLesson` after quiz success.
- Platform-wide charts on **Progress & Analytics** page are computed in the client from cached **courses**, **lessons**, **enrollments**, and **completions** returned by their respective modules; no separate “list platform analytics” action is required unless you add it later.

---

## 2. Endpoint

**Method:** `POST`  
**URL:** `https://{api-host}/v1/progress`  
Example (replace host): `https://ryipt781n1.execute-api.us-east-2.amazonaws.com/v1/progress`

**Headers (every request):**

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer <access_token>` |
| `Content-Type` | `application/json` |

**Routing:** The handler inspects JSON body field **`action`** and dispatches to the matching implementation (same pattern as COURSES / ENROLLMENTS / LESSONS).

---

## 3. Response Envelope

**Success:**

```json
{
  "success": true,
  "data": {}
}
```

**Failure (recommended — align with COURSES):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary"
  }
}
```

**Alternative (ENROLLMENTS-style) for compatibility:**

```json
{
  "success": false,
  "message": "Human-readable summary"
}
```

Clients should treat `success === false` and read `error.message` or top-level `message`.

**HTTP status mapping (recommended):**

| HTTP | `error.code` (when using nested error) |
|------|----------------------------------------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_ERROR` |

---

## 4. Authentication & Tenancy

- Every request is authenticated with the **access JWT** (`Authorization: Bearer`).
- **`sub`** (or your gateway’s user id claim) identifies the caller.
- **`tid`** (tenant id) scopes all rows: `resource.tenantId === jwt.tid`.
- Anonymous requests: **401**.

---

## 5. Permission Model (Fine-Grained)

Map gateway permission strings to behavior (examples; your IAM may use `progress:*`, `progress:view`, `progress:update`, or app-specific names):

| Concept | Typical tokens | Meaning |
|---------|----------------|--------|
| Admin-like | `*:*` or `progress:*` | Full access to all actions where data belongs to tenant. |
| View all | `progress:view_all` | See all completion rows / analytics across tenant (or as policy defines). |
| View course | `progress:view_course` | See progress for learners in courses the user **staffs** (creator or assigned teacher). |
| View own | `progress:view_own` | Learner may only read/update **own** progress rows. |
| Update own | `progress:update` (often paired with own) | Record start/track/complete for **self** only. |

**Role shortcuts (if you use coarse roles without custom claims):**

- **STUDENT**: `getStudentProgress` (own rows only), `startLesson`, `trackProgress`, `completeLesson` for **self** and only when enrolled in the course.
- **TEACHER**: Same read rules as student for **own** learning; plus `getCourseProgressSummary` for courses they **manage** (creator or `teacherIds`); may receive broader `getStudentProgress` per product policy (e.g. all rows for roster courses).
- **ADMIN / MANAGER**: Full tenant read; analytics for any course in tenant.

---

## 6. Business Rules (Global)

### 6.1 Lesson progress record (logical model)

One row per `(tenantId, userId, courseId, lessonId)` with at least:

| Field | Type | Notes |
|-------|------|--------|
| `userId` | string (UUID) | Learner |
| `courseId` | string | Must reference existing course in tenant |
| `lessonId` | string | Must reference existing lesson; for course-scoped lessons, `lesson.courseId === courseId` |
| `completed` | boolean | True when lesson is done |
| `progress` | number | 0–100 inclusive |
| `completedAt` | ISO string, optional | Set when first reaching complete |
| `lastActivityAt` | ISO string | Updated on start/track/complete |
| `version` | integer, optional | For optimistic concurrency |

### 6.2 Who may mutate progress

- **startLesson / trackProgress / completeLesson**: Target **userId** is always the **caller** (no impersonation in v1).  
- **Student**: Must have **ACTIVE** (or policy-approved) **enrollment** in `courseId`. **SUSPENDED** / **DROPPED** / not enrolled → **403**.
- **Teacher/Admin** updating **someone else’s** row: **not** supported in current SPA; reserve for future `userId` param if needed.

### 6.3 Course and lesson gating

- **Course** must exist, not **DELETED**; for learners, enrollment rules per ENROLLMENTS module (typically course **PUBLISHED** and enrollment **ACTIVE**).
- **Lesson** must exist and be visible to the learner per LESSONS policy (e.g. **PUBLISHED** lesson, sequential rules enforced by LESSONS + client; server may double-check).

### 6.4 Completion side effects

When **`completeLesson`** is called or **`trackProgress`** reaches `progress >= 100`:

- Set `completed = true`, `progress = 100`, set `completedAt` if not set.
- **Optional (recommended):** If **all** non-deleted lessons in the course have `completed === true` for that user, update the **ENROLLMENTS** row to `COMPLETED` via ENROLLMENTS module (or internal shared transaction). This matches the demo behavior (“course completed” when every lesson is done).

---

## 7. Actions

### 7.1 getStudentProgress

**Purpose:** Return lesson-level progress rows for dashboard refresh and `%` calculation in the SPA.

**Permission:**

- **Student**: Only rows where `userId === jwt.sub`.
- **Teacher**: Implementation-defined — either **own** rows only, or all rows for courses they staff, or all in tenant if `progress:view_all`.
- **Admin**: All rows in tenant (subject to performance; consider pagination in a later version).

**Request:**

```json
{
  "action": "getStudentProgress"
}
```

(No extra fields required for v1.)

**Success — data shape:**

Return an **array** (or `{ "items": [...] }` if you prefer pagination later; the SPA’s client normalizes arrays from `data`).

Each item:

```json
{
  "userId": "uuid",
  "courseId": "uuid",
  "lessonId": "uuid",
  "completed": true,
  "progress": 100,
  "completedAt": "2025-01-15T12:00:00.000Z",
  "lastActivityAt": "2025-01-15T12:00:00.000Z"
}
```

**Errors:**

- 401 Unauthorized  
- 403 Forbidden  

---

### 7.2 startLesson

**Purpose:** First touch when a learner opens a lesson (Lesson Viewer). Idempotent: if a progress row exists, optionally refresh `lastActivityAt` only.

**Permission:** `progress:update` (own) or equivalent; **enrolled** in `courseId`.

**Request:**

```json
{
  "action": "startLesson",
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid"
}
```

**Validation:**

- `courseId`, `lessonId` required.
- Caller enrolled (ACTIVE) in course (unless admin/teacher test bypass — product decision).

**Success:**

```json
{
  "success": true,
  "data": {
    "started": true
  }
}
```

**Errors:**

- 400 — missing fields, invalid ids  
- 403 — not enrolled / lesson not accessible  
- 404 — course or lesson not found (tenant-scoped)  

---

### 7.3 trackProgress

**Purpose:** Update scroll-based or computed **0–100** progress while viewing a lesson (intersection observer in UI).

**Permission:** Same as `startLesson`.

**Request:**

```json
{
  "action": "trackProgress",
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid",
  "progress": 67
}
```

**Validation:**

- `courseId`, `lessonId` required.
- `progress` required, number in **0–100** (server clamps if needed).
- If `progress >= 100`, set `completed = true` and `completedAt` as in mock behavior.

**Success:**

```json
{
  "success": true,
  "data": {
    "tracked": true
  }
}
```

**Errors:** Same family as `startLesson`.

---

### 7.4 completeLesson

**Purpose:** Explicit “Mark complete” in Lesson Viewer; sets lesson to 100% complete regardless of prior `trackProgress`.

**Permission:** Same as `startLesson`.

**Request:**

```json
{
  "action": "completeLesson",
  "courseId": "course-uuid",
  "lessonId": "lesson-uuid"
}
```

**Behavior:**

- Upsert progress row: `completed=true`, `progress=100`, `completedAt`, `lastActivityAt` updated.
- Run **course completion check** (section 6.4): if all lessons in course completed for user, update enrollment to **COMPLETED** (coordinate with ENROLLMENTS API).

**Success:**

```json
{
  "success": true,
  "data": {
    "completed": true
  }
}
```

Optional extra fields:

```json
{
  "completed": true,
  "courseCompleted": false,
  "enrollmentStatus": "ACTIVE"
}
```

**Errors:** Same as `startLesson`.

---

### 7.5 getCourseProgressSummary

**Purpose:** Per-course analytics for **Progress** drill-down or instructor dashboard (`fetchCourseProgressSummary` in SPA). **Not** used for the main “Progress & Analytics” charts (those aggregate client-side from list endpoints).

**Permission:**

- **Student:** **403** — not allowed (current UI only calls this for staff; still enforce server-side).
- **Teacher:** Allowed if caller **manages** the course (creator or member of `teacherIds`).
- **Admin / Manager:** Allowed for any course in tenant.

**Request:**

```json
{
  "action": "getCourseProgressSummary",
  "courseId": "course-uuid"
}
```

**Success:**

```json
{
  "success": true,
  "data": {
    "courseId": "course-uuid",
    "totalLessons": 6,
    "enrolledStudents": 35,
    "averageProgress": 42,
    "completionRate": 18,
    "studentBreakdown": [
      {
        "userId": "uuid",
        "userName": "Jane Doe",
        "lessonsCompleted": 3,
        "totalLessons": 6,
        "progress": 50
      }
    ]
  }
}
```

**Field notes:**

- `totalLessons`: Count of **non-deleted** lessons attached to the course (same basis as LESSONS list).
- `enrolledStudents`: Count of enrollments excluding **DROPPED** / deleted per ENROLLMENTS policy.
- `averageProgress`: Mean of per-student **course** % (each student: completed lesson count / `totalLessons` × 100).
- `completionRate`: % of enrolled students with **100%** course progress (or alternative definition — document if different).
- `studentBreakdown`: One entry per enrolled student; `progress` is 0–100 for that course.

**Errors:**

- 400 — missing `courseId`  
- 403 — insufficient role / not course staff  
- 404 — course not found  

---

## 8. CORS & OPTIONS

Same as other modules: return CORS headers on all responses; handle `OPTIONS` preflight in the Lambda / API Gateway integration.

---

## 9. Integration Dependencies

| Dependency | Use |
|------------|-----|
| **ENROLLMENTS** | Active enrollment required for learner mutations; completion may set enrollment **COMPLETED**. |
| **LESSONS** | Lesson must exist; `lessonId` belongs to `courseId` for course lessons. |
| **COURSES** | Course must exist; soft-deleted courses should block new progress. |
| **AUTH** | JWT `sub`, `tid`, optional `role` / custom permissions. |

---

## 10. Client SPA Usage Summary

| UI area | Actions used |
|---------|----------------|
| `LmsContext.refresh` | `getStudentProgress` (loads `completions` in memory) |
| Lesson Viewer (learner) | `startLesson`, `trackProgress`, `completeLesson` |
| Optional course analytics | `getCourseProgressSummary` |
| Progress & Analytics page | **No extra progress actions** — aggregates from context (`courses`, `lessons`, `enrollments`, `completions`) |

---

## 11. Quick Copy/Paste Examples

```json
{"action":"getStudentProgress"}
```

```json
{"action":"startLesson","courseId":"CID","lessonId":"LID"}
```

```json
{"action":"trackProgress","courseId":"CID","lessonId":"LID","progress":72}
```

```json
{"action":"completeLesson","courseId":"CID","lessonId":"LID"}
```

```json
{"action":"getCourseProgressSummary","courseId":"CID"}
```

---

## 12. Versioning

- Breaking changes → `/v2/progress` or new `action` names with deprecation window.
- Add **pagination** to `getStudentProgress` when tenant data grows (`page`, `limit`, `sortBy`).

---

## 13. Optional Future Actions (not in current SPA)

Document for roadmap only; **do not require** for parity with current Learning Lab build:

- `listCourseProgress` — paged progress rows for one course (admin).
- `resetLessonProgress` — instructor resets one learner’s lesson (support).
- `exportProgress` — CSV for compliance.

---

*This contract is generated to match the Fusion Starter Learning Lab client behavior and mock module `handleProgress` actions; adjust field names to your DynamoDB schema while keeping `action` routing and envelopes consistent.*
