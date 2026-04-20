# Learning Lab — Lessons Module: Backend API Requirements

**Author:** Senior Business Analyst  
**Audience:** Backend API development team / LLM  
**Version:** 1.0  
**Date:** April 14, 2026  
**Status:** Requirements specification (ready for implementation)

---

## 1. Executive Summary

The Lessons module is the core content-delivery system within Learning Lab. It allows **teachers** to author rich, multi-block lessons inside courses, and **students** to consume those lessons in an interactive viewer with progress tracking, sequential locking, and completion workflows.

The frontend is fully built and currently calls the following API surface:

| Route | Actions needed |
|-------|---------------|
| `POST /lessons` | createLesson, updateLesson, publishLesson, archiveLesson, deleteLesson, addBlock, updateBlock, removeBlock, getLesson, listLessons |
| `POST /progress` | startLesson, trackProgress, completeLesson, getLessonProgress, getStudentProgress |

**Critical gap:** The existing `/lessons` Lambda has basic CRUD (create, update, publish, archive, delete, get, list) but **does not** implement the block-level actions (addBlock, updateBlock, removeBlock) as separate actions. The existing `/progress` Lambda currently mirrors the Enrollments module and has **zero** lesson-level progress actions.

This document specifies every data structure, action, validation rule, and authorization requirement the backend must implement so the frontend works end-to-end.

---

## 2. Domain Model

### 2.1 Lesson Entity

```
Lesson {
  lessonId        : string (PK, generated server-side)
  courseId         : string (FK → Course, required, immutable after creation)
  tenantId        : string (from authorizer context, immutable)
  title           : string (1–500 chars, required)
  description     : string (0–5000 chars, optional, default "")
  lessonOrder     : integer (position within the course, required on create)
  status          : enum("DRAFT", "PUBLISHED", "ARCHIVED"), default "DRAFT"
  sequential      : boolean (default true)
                    — When true, the *next* lesson in the course is locked until
                      the student completes this one.
  blocks          : Block[] (ordered list of content blocks; see §2.2)
  version         : integer (monotonically increasing; bumped on title/blocks changes)
  createdBy       : string (userId from authorizer)
  createdAt       : ISO-8601
  updatedAt       : ISO-8601
  updatedBy       : string (userId from authorizer)
  deleted         : boolean (soft-delete flag, default false)
}
```

### 2.2 Lesson Block (embedded sub-document or child table)

A lesson contains zero or more **blocks**. Blocks are the atomic units of content inside a lesson.

```
Block {
  blockId    : string (PK, generated server-side)
  lessonId   : string (FK → Lesson)
  type       : enum("TEXT", "VIDEO", "DOCUMENT", "IMAGE", "QUIZ")
               — Frontend also uses "pdf" and "download"; map them:
                 pdf      → DOCUMENT
                 download → DOCUMENT
                 text     → TEXT
                 video    → VIDEO
                 quiz     → QUIZ
  order      : integer (0-based position within the lesson)
  title      : string (0–500 chars, optional)
  textData   : string (markdown body for TEXT/QUIZ blocks, max 50 000 chars)
  assetUrl   : string (URL for VIDEO / DOCUMENT / IMAGE after upload)
  fileName   : string (original filename for display)
  createdAt  : ISO-8601
  updatedAt  : ISO-8601
}
```

### 2.3 Lesson Version Snapshot (audit / history)

Every time a lesson is saved (title or blocks change), a version snapshot is recorded.

```
LessonVersionSnapshot {
  lessonId   : string (FK → Lesson)
  version    : integer
  savedAt    : ISO-8601
  savedBy    : string (userId)
  snapshot   : JSON (full Lesson object at this version, including blocks)
}
```

### 2.4 Lesson Progress (per-student, per-lesson)

```
LessonProgress {
  userId       : string (FK → User)
  lessonId     : string (FK → Lesson)
  courseId      : string (FK → Course)
  tenantId     : string
  progress     : integer (0–100, percentage)
  completed    : boolean
  lastViewedAt : ISO-8601
  completedAt  : ISO-8601 | null
}
```

### 2.5 Lesson Completion (per-student, per-course, per-lesson)

Used for the "mark lesson complete" action and for computing course-level completion percentage.

```
LessonCompletion {
  userId       : string
  courseId      : string
  lessonId     : string
  completed    : boolean
  completedAt  : ISO-8601 | null
  lastActivityAt : ISO-8601
}
```

---

## 3. LESSONS API Actions (`POST /lessons`)

All requests follow the standard envelope:
```json
{
  "action": "<actionName>",
  ...fields
}
```

Responses follow:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "..." }
```

### 3.1 createLesson

**Purpose:** Create a new lesson inside a course.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"createLesson"` | yes | |
| courseId | string | yes | Must exist and belong to tenant |
| title | string | yes | 1–500 characters |
| lessonOrder | integer | yes | Position in the course (1-based) |
| description | string | no | Max 5000 chars |
| sequential | boolean | no | Default `true` |

**Authorization:**
- Permission: `lessons:create`
- User must have edit access to the parent course (owner or `courses:update` grant)

**Success response data:**
```json
{
  "lessonId": "les_abc123",
  "courseId": "crs_xyz",
  "title": "Introduction",
  "lessonOrder": 1,
  "status": "DRAFT",
  "version": 1,
  "sequential": true,
  "blocks": [],
  "createdAt": "2026-04-14T10:00:00Z",
  "updatedAt": "2026-04-14T10:00:00Z"
}
```

**Side effects:**
- Create a version snapshot (version 1).
- Append `lessonId` to the parent course's `lessonOrder` array (if the course tracks lesson ordering).

---

### 3.2 updateLesson

**Purpose:** Update lesson metadata (title, description, sequential flag). Does NOT touch blocks.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"updateLesson"` | yes | |
| lessonId | string | yes | |
| title | string | no | 1–500 chars if provided |
| description | string | no | Max 5000 chars |
| sequential | boolean | no | |

**Authorization:** `lessons:update`

**Concurrency check (important):**  
The frontend tracks a `baseline updatedAt` timestamp. If the server's `updatedAt` is newer than what the client sent, reject with:
```json
{ "success": false, "message": "Lesson was modified by another user. Refresh and retry." }
```

If the `title` changes, bump `version` by 1. Always update `updatedAt` and `updatedBy`.

**Success response data:**
```json
{
  "lessonId": "les_abc123",
  "updated": true,
  "version": 2,
  "updatedAt": "2026-04-14T11:00:00Z"
}
```

**Side effects:**
- Create a new version snapshot if `version` was bumped.

---

### 3.3 addBlock

**Purpose:** Append a new content block to a lesson.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"addBlock"` | yes | |
| lessonId | string | yes | |
| type | `"TEXT"` / `"VIDEO"` / `"DOCUMENT"` / `"IMAGE"` / `"QUIZ"` | yes | |
| order | integer | yes | 0-based position |
| title | string | no | Block title (max 500 chars) |
| textData | string | no | Markdown body for TEXT / QUIZ blocks (max 50 000 chars) |
| assetUrl | string | no | Pre-signed URL or stored URL for media blocks |
| fileName | string | no | Original filename for display |

**Authorization:** `lessons:update`

**Validation:**
- `type` must be one of the five supported values.
- `order` must be >= 0.
- If `type` is TEXT or QUIZ, `textData` should be accepted.
- If `type` is VIDEO, DOCUMENT, or IMAGE, `assetUrl` should be accepted.

**Success response data:**
```json
{
  "blockId": "blk_001",
  "lessonId": "les_abc123",
  "type": "TEXT",
  "order": 0
}
```

**Side effects:**
- Bump lesson `version` by 1.
- Create a new version snapshot.
- Update lesson `updatedAt` and `updatedBy`.

---

### 3.4 updateBlock

**Purpose:** Update an existing block's content, title, type, or order.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"updateBlock"` | yes | |
| lessonId | string | yes | |
| blockId | string | yes | |
| type | enum | no | Can change block type (e.g., TEXT → VIDEO) |
| order | integer | no | Reposition within lesson |
| title | string | no | |
| textData | string | no | |
| assetUrl | string | no | |
| fileName | string | no | |

**Authorization:** `lessons:update`

**Success response data:**
```json
{
  "blockId": "blk_001",
  "lessonId": "les_abc123",
  "updated": true
}
```

**Side effects:** Same as addBlock (bump version, snapshot, timestamps).

---

### 3.5 removeBlock

**Purpose:** Remove a block from a lesson.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"removeBlock"` | yes | |
| lessonId | string | yes | |
| blockId | string | yes | |

**Authorization:** `lessons:update`

**Side effects:**
- Remove the block record.
- Re-index remaining blocks' `order` values to be contiguous (0, 1, 2...).
- Bump lesson `version`, snapshot, timestamps.

**Success response data:**
```json
{
  "blockId": "blk_001",
  "removed": true
}
```

---

### 3.6 reorderBlocks *(new action — not in original guide)*

**Purpose:** Set the order of all blocks in a single call (drag-and-drop reordering in the builder).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"reorderBlocks"` | yes | |
| lessonId | string | yes | |
| blockOrder | string[] | yes | Ordered array of `blockId` values |

**Authorization:** `lessons:update`

**Validation:**
- `blockOrder` must contain exactly the set of current `blockId` values for the lesson (no additions, no removals).

**Side effects:** Update each block's `order` to match the new position. Bump version, snapshot, timestamps.

---

### 3.7 publishLesson

**Purpose:** Change lesson status from DRAFT to PUBLISHED.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"publishLesson"` | yes | |
| lessonId | string | yes | |

**Authorization:** `lessons:publish`

**Validation:**
- Lesson must have at least one block.
- Lesson must have a non-empty title.
- Lesson `status` must currently be DRAFT (or ARCHIVED for re-publish).

---

### 3.8 archiveLesson

**Purpose:** Set lesson status to ARCHIVED (hides from students, keeps data).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"archiveLesson"` | yes | |
| lessonId | string | yes | |

**Authorization:** `lessons:update`

---

### 3.9 deleteLesson

**Purpose:** Soft-delete a lesson (`deleted = true`). Hard-delete is optional.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"deleteLesson"` | yes | |
| lessonId | string | yes | |

**Authorization:** `lessons:delete`

**Side effects:**
- Set `deleted = true`.
- Remove `lessonId` from the parent course's `lessonOrder` array.
- Do NOT delete associated enrollments or progress records (they become orphaned but harmless).

---

### 3.10 getLesson

**Purpose:** Retrieve a single lesson with all its blocks.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"getLesson"` | yes | |
| lessonId | string | yes | |

**Authorization:** `lessons:view`

**Response data:**
```json
{
  "lessonId": "les_abc123",
  "courseId": "crs_xyz",
  "title": "Introduction",
  "description": "...",
  "status": "PUBLISHED",
  "sequential": true,
  "version": 3,
  "blocks": [
    {
      "blockId": "blk_001",
      "type": "TEXT",
      "order": 0,
      "title": "Welcome",
      "textData": "# Hello World\nThis is lesson one.",
      "assetUrl": null,
      "fileName": null
    },
    {
      "blockId": "blk_002",
      "type": "VIDEO",
      "order": 1,
      "title": "Demo video",
      "textData": null,
      "assetUrl": "https://cdn.example.com/videos/demo.mp4",
      "fileName": "demo.mp4"
    }
  ],
  "createdBy": "usr_teacher1",
  "createdAt": "2026-04-14T10:00:00Z",
  "updatedAt": "2026-04-14T12:00:00Z",
  "updatedBy": "usr_teacher1"
}
```

**Important:** Include `blocks` sorted by `order` ascending.

---

### 3.11 listLessons

**Purpose:** List all lessons for a given course.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"listLessons"` | yes | |
| courseId | string | yes | |
| status | string | no | Filter: "DRAFT", "PUBLISHED", "ARCHIVED" |

**Authorization:** `lessons:view`

**Response data:** Array of lesson summaries (same shape as getLesson, but blocks can be omitted or included depending on performance needs — the frontend currently expects blocks to be populated).

---

### 3.12 getLessonHistory *(new action — not in original guide)*

**Purpose:** Retrieve version history for a lesson.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"getLessonHistory"` | yes | |
| lessonId | string | yes | |
| limit | integer | no | Default 50, max 100 |

**Authorization:** `lessons:view` AND (course owner OR `courses:update`)

**Response data:**
```json
{
  "lessonId": "les_abc123",
  "history": [
    {
      "version": 3,
      "savedAt": "2026-04-14T12:00:00Z",
      "savedBy": "usr_teacher1",
      "snapshot": { /* full lesson object at this version */ }
    },
    {
      "version": 2,
      "savedAt": "2026-04-14T11:00:00Z",
      "savedBy": "usr_teacher1",
      "snapshot": { ... }
    }
  ]
}
```

**Ordering:** Most recent first (descending by `version`).

---

## 4. PROGRESS API Actions (`POST /progress`)

These actions are **currently missing** from the Progress Lambda. The Progress Lambda currently duplicates the Enrollments module. The following actions must be **added** for lesson-level progress tracking.

### 4.1 startLesson

**Purpose:** Record that a student has started viewing a lesson.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"startLesson"` | yes | |
| lessonId | string | yes | |
| courseId | string | yes | |

**Authorization:** Authenticated user (self-only — `userId` is taken from authorizer context).

**Behavior:**
- If no progress record exists for this (userId, lessonId), create one with `progress = 0`, `completed = false`.
- If record already exists, update `lastViewedAt` only.
- This is **idempotent**.

**Response data:**
```json
{
  "userId": "usr_student1",
  "lessonId": "les_abc123",
  "courseId": "crs_xyz",
  "progress": 0,
  "completed": false,
  "lastViewedAt": "2026-04-14T13:00:00Z"
}
```

---

### 4.2 trackProgress

**Purpose:** Update the student's progress percentage as they navigate through lesson blocks.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"trackProgress"` | yes | |
| lessonId | string | yes | |
| courseId | string | yes | |
| progress | integer | yes | 0–100 |

**Authorization:** Self-only (userId from authorizer).

**Behavior:**
- Update `progress` to the given value (never decrease — use `MAX(current, new)`).
- Update `lastViewedAt`.
- If `progress == 100`, set `completed = true` and `completedAt`.

**Formula used by the frontend:**
```
progress = Math.round(((currentBlockIndex + 1) / totalBlocks) * 100)
```

---

### 4.3 completeLesson

**Purpose:** Explicitly mark a lesson as complete (student clicks "Mark lesson complete" button).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"completeLesson"` | yes | |
| lessonId | string | yes | |
| courseId | string | yes | |

**Authorization:** Self-only.

**Behavior:**
- Set `progress = 100`, `completed = true`, `completedAt = now`, `lastViewedAt = now`.
- Check if ALL lessons in the course are now completed for this student. If yes, update the student's enrollment status to `COMPLETED` (call enrollments:updateEnrollmentStatus or do it internally).

**This is the critical action that drives:**
1. Sequential lock release (next lesson becomes unlocked)
2. Course-level completion percentage
3. Enrollment auto-completion

---

### 4.4 getLessonProgress

**Purpose:** Get progress for a specific lesson for a specific user.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"getLessonProgress"` | yes | |
| lessonId | string | yes | |
| userId | string | no | Defaults to current user. Admins/teachers can query other users. |

**Authorization:**
- Own progress: any authenticated user
- Other user's progress: `progress:view_all` or `progress:view_course` (if teacher is assigned to the course)

---

### 4.5 getStudentProgress

**Purpose:** Get all lesson progress for a student across a course, or across all courses.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"getStudentProgress"` | yes | |
| userId | string | no | Defaults to current user |
| courseId | string | no | If provided, scopes to one course |

**Authorization:**
- Own progress: any authenticated user
- Other user's progress: `progress:view_all` or `progress:view_course`

**Response data:**
```json
{
  "userId": "usr_student1",
  "progress": [
    {
      "lessonId": "les_001",
      "courseId": "crs_xyz",
      "progress": 100,
      "completed": true,
      "lastViewedAt": "2026-04-14T13:00:00Z",
      "completedAt": "2026-04-14T13:05:00Z"
    },
    {
      "lessonId": "les_002",
      "courseId": "crs_xyz",
      "progress": 40,
      "completed": false,
      "lastViewedAt": "2026-04-14T14:00:00Z",
      "completedAt": null
    }
  ]
}
```

---

### 4.6 getCourseProgressSummary *(new — for dashboard/analytics)*

**Purpose:** Aggregate progress for a course (all enrolled students).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | `"getCourseProgressSummary"` | yes | |
| courseId | string | yes | |

**Authorization:** `progress:view_course` or `progress:view_all`

**Response data:**
```json
{
  "courseId": "crs_xyz",
  "totalLessons": 5,
  "enrolledStudents": 30,
  "averageProgress": 62,
  "completionRate": 40,
  "studentBreakdown": [
    { "userId": "usr_s1", "lessonsCompleted": 3, "progressPercent": 60 },
    { "userId": "usr_s2", "lessonsCompleted": 5, "progressPercent": 100 }
  ]
}
```

---

## 5. File Upload Requirements

The Lesson Builder supports attaching files to blocks (VIDEO, DOCUMENT/PDF, IMAGE, download).

### 5.1 Frontend upload expectations

The frontend currently performs a **simulated upload** (creates a `blob:` URL). For real backend integration, the frontend expects either:

**Option A: Pre-signed URL flow (recommended)**
1. Frontend calls a new action: `POST /lessons` with `{ "action": "getUploadUrl", "lessonId": "...", "blockId": "...", "fileName": "demo.mp4", "contentType": "video/mp4" }`
2. Backend returns `{ "success": true, "data": { "uploadUrl": "https://s3.../presigned", "assetUrl": "https://cdn.../demo.mp4" } }`
3. Frontend PUTs the file directly to S3 via the pre-signed URL.
4. Frontend then calls `updateBlock` with the returned `assetUrl`.

**Option B: Multipart upload through the API**
- Not recommended for Lambda + API Gateway (6MB body limit).

### 5.2 Validation rules (enforce server-side too)

| Block type | Allowed extensions | Max file size |
|------------|-------------------|---------------|
| VIDEO | .mp4 | 500 MB |
| DOCUMENT (pdf) | .pdf | 50 MB |
| IMAGE | .png, .jpg, .jpeg | 10 MB |
| DOCUMENT (download) | .mp4, .pdf, .png, .jpg, .jpeg | 500 MB |

---

## 6. Sequential Lesson Locking (Business Logic)

This is a critical feature the frontend relies on.

### How it works:

1. Each lesson has a `sequential` boolean flag (default `true`).
2. Lessons are ordered within a course via the `Course.lessonOrder` array.
3. For a student, **lesson N+1 is locked** if:
   - Lesson N has `sequential = true`, AND
   - The student has NOT completed lesson N (no LessonCompletion record with `completed = true`)
4. The **first lesson** in a course is never locked.

### Frontend behavior:
- Locked lessons show a "Locked" badge and a disabled button.
- Unlocked lessons show an "Open" button linking to the viewer.
- When a student completes a lesson, the next one becomes available.

### Backend responsibility:
- The `getLesson` and `listLessons` responses should include enough data for the frontend to compute lock state.
- Alternatively, add a computed `locked` boolean per-lesson in `listLessons` when a `userId` is provided.
- The `completeLesson` action releases the lock on the next sequential lesson.

---

## 7. Lesson Viewer Behavior (what the backend must support)

The Lesson Viewer (`/viewer?courseId=X&lessonId=Y`) displays lesson blocks one at a time in a paginated card view.

### Viewer workflow:
1. **Load lesson:** `getLesson(lessonId)` — returns all blocks sorted by `order`.
2. **Track progress:** As the student navigates blocks, the frontend calls `trackProgress` with the current percentage: `Math.round(((blockIndex + 1) / totalBlocks) * 100)`.
3. **Render block by type:**
   - **TEXT:** Render `textData` as Markdown (supports full GitHub-flavored markdown).
   - **VIDEO:** Render `<video>` player with `assetUrl` as `src`. Supports play/pause controls.
   - **DOCUMENT (PDF):** Render in an `<iframe>` with `assetUrl`.
   - **IMAGE:** Render `<img>` with `assetUrl`.
   - **QUIZ:** Render `textData` as a quiz placeholder (no interactive quiz engine yet — see §10).
   - **Download:** Render a download link with `assetUrl` and `fileName`.
4. **Mark complete:** Student clicks "Mark lesson complete" → calls `completeLesson`.
5. **Navigate to next:** If there's a next lesson in the course (not locked), show "Next lesson" link.

---

## 8. Lesson Builder Hub (Authoring Entry Point)

The Lesson Builder Hub (`/lesson-builder`) shows teachers a list of **their courses** with an "Add lesson" button next to each. The backend supports this through:

- `POST /courses` → `{ "action": "listCourses" }` (teacher sees their own courses)
- `POST /lessons` → `{ "action": "createLesson", "courseId": "..." }` (creates a new lesson)

No additional backend work needed for this screen.

---

## 9. Version History

The frontend has a Version History page at `/courses/:courseId/lessons/:lessonId/history`.

### What the frontend displays:
- List of version snapshots, ordered most-recent-first.
- Each entry shows: version number, saved timestamp, saved-by user ID, block count, and lesson title at that version.
- Currently this uses client-side storage. **This must move to the backend.**

### Backend action needed: `getLessonHistory` (see §3.12)

### Version tracking rules:
- Bump `version` on every save that changes `title`, `description`, or `blocks`.
- Store the full lesson snapshot (including all blocks at that point in time).
- Retain at most **50 versions** per lesson (oldest pruned).

---

## 10. Known Feature Gaps (Backend Team Should Be Aware)

| Feature | Frontend state | Backend state | Action needed |
|---------|---------------|---------------|---------------|
| **Block-level CRUD** (addBlock, updateBlock, removeBlock) | Frontend builds blocks in-memory and sends full `blocks` array on save | Documented in integration guide but unclear if implemented | Verify and implement §3.3–3.6 |
| **reorderBlocks** action | Frontend reorders blocks via drag (up/down arrows) | Not in integration guide | New action needed (§3.6) |
| **getLessonHistory** | Frontend page exists, reads from localStorage | Not in integration guide | New action needed (§3.12) |
| **All progress actions** (startLesson, trackProgress, completeLesson, etc.) | Frontend calls `markLessonComplete` client-side, tracks progress in localStorage | Progress Lambda mirrors Enrollments — **no lesson progress** | Full implementation needed (§4.1–4.6) |
| **File upload (pre-signed URL)** | Frontend simulates upload with blob URLs | No upload infrastructure | Implement pre-signed URL flow (§5.1) |
| **Quiz blocks** | Placeholder only ("Quiz placeholder — connect a question bank later") | Nothing | Future feature — no backend work now, but preserve `QUIZ` as a valid block type |
| **Audit logs for lesson operations** | Audit log page exists but shows "not available" | No `listAuditLogs` action | Future feature |

---

## 11. Permission Matrix (Lessons-Specific)

| Action | Required permission | Additional condition |
|--------|-------------------|---------------------|
| createLesson | `lessons:create` | User must have edit rights on the parent course |
| updateLesson | `lessons:update` | Same course-ownership check |
| addBlock / updateBlock / removeBlock / reorderBlocks | `lessons:update` | Same course-ownership check |
| publishLesson | `lessons:publish` | |
| archiveLesson | `lessons:update` | |
| deleteLesson | `lessons:delete` | |
| getLesson | `lessons:view` | Visibility follows course status (PUBLISHED = any enrolled student; DRAFT = only course owner/admin) |
| listLessons | `lessons:view` | Same visibility |
| getLessonHistory | `lessons:view` + course owner or `courses:update` | |
| startLesson / trackProgress / completeLesson | Authenticated (self-only) | Student must be enrolled in the course |
| getLessonProgress (own) | Authenticated (self-only) | |
| getLessonProgress (other) | `progress:view_all` or `progress:view_course` | |
| getStudentProgress | Same as getLessonProgress | |
| getCourseProgressSummary | `progress:view_course` or `progress:view_all` | |

---

## 12. Error Handling Expectations

The frontend handles these error scenarios. The backend must return clear error messages for each.

| Scenario | Expected HTTP status | Error message pattern |
|----------|---------------------|----------------------|
| Missing `action` field | 400 | "Missing or invalid action" |
| Missing required field (e.g., `courseId`) | 400 | "Missing required field: courseId" |
| Lesson not found | 404 | "Lesson not found" |
| Block not found | 404 | "Block not found" |
| Unauthorized (no token) | 401 | "Unauthorized" |
| Forbidden (insufficient permissions) | 403 | "Forbidden: insufficient permissions" |
| Concurrent edit conflict | 409 | "Lesson was modified by another user. Refresh and retry." |
| Course not found (on createLesson) | 404 | "Course not found" |
| Student not enrolled (on progress actions) | 403 | "Student is not enrolled in this course" |
| Invalid block type | 400 | "Invalid block type. Must be one of: TEXT, VIDEO, DOCUMENT, IMAGE, QUIZ" |
| Lesson has no blocks (on publish) | 400 | "Cannot publish a lesson with no content blocks" |
| File too large (if validating server-side) | 400 | "File exceeds maximum size of X MB" |

---

## 13. Data Flow Diagrams

### 13.1 Lesson Authoring Flow

```
Teacher opens Lesson Builder Hub
  → GET /courses (listCourses) → shows their courses
  → Clicks "Add lesson"
  → POST /lessons (createLesson, courseId, title, lessonOrder)
  → Builder loads: teacher adds blocks
    → Each block: type, title, textData/assetUrl
    → Reorder with up/down arrows
    → Upload file → getUploadUrl → PUT to S3 → updateBlock with assetUrl
  → Clicks "Save lesson"
    → POST /lessons (updateLesson, lessonId, title, description, sequential)
    → For each new/modified block: POST /lessons (addBlock or updateBlock)
    → Version snapshot created server-side
  → Clicks "Version history" → POST /lessons (getLessonHistory, lessonId)
```

### 13.2 Student Viewing Flow

```
Student opens Course Detail page
  → GET /courses (getCourse, courseId)
  → GET /lessons (listLessons, courseId) → lesson list with lock states
  → Clicks "Open" on an unlocked lesson → navigates to /viewer
  → POST /progress (startLesson, lessonId, courseId)
  → Viewer loads: POST /lessons (getLesson, lessonId) → blocks array
  → Student navigates blocks (Previous / Next)
    → POST /progress (trackProgress, lessonId, courseId, progress%)
  → Student clicks "Mark lesson complete"
    → POST /progress (completeLesson, lessonId, courseId)
    → Backend checks: are ALL lessons in course completed?
      → If yes: update enrollment status to COMPLETED
    → Next sequential lesson is now unlocked
  → Student clicks "Next lesson" → viewer reloads with next lessonId
```

---

## 14. Implementation Priority

| Priority | Action | Rationale |
|----------|--------|-----------|
| **P0 (Critical)** | createLesson, updateLesson, getLesson, listLessons, deleteLesson | Core CRUD — nothing works without these |
| **P0 (Critical)** | addBlock, updateBlock, removeBlock | Blocks are the content — lessons are empty without block CRUD |
| **P0 (Critical)** | completeLesson, trackProgress | Students cannot complete courses without progress tracking |
| **P1 (High)** | publishLesson, archiveLesson | Needed for course lifecycle |
| **P1 (High)** | startLesson, getLessonProgress, getStudentProgress | Needed for progress dashboards |
| **P1 (High)** | getUploadUrl (pre-signed URL for file upload) | Without this, media blocks are non-functional |
| **P2 (Medium)** | reorderBlocks | Convenience — frontend can work around via multiple updateBlock calls |
| **P2 (Medium)** | getLessonHistory | History page is built but not critical for core workflow |
| **P2 (Medium)** | getCourseProgressSummary | Analytics/dashboard feature |
| **P3 (Low)** | Quiz engine (interactive quizzes) | Future feature — QUIZ block type reserved |
| **P3 (Low)** | listAuditLogs for lesson operations | Future feature |

---

## 15. Acceptance Criteria Summary

The backend implementation is considered complete when:

1. A teacher can create a lesson with blocks (TEXT, VIDEO, DOCUMENT, IMAGE, QUIZ) and save it.
2. A teacher can edit lesson title, description, sequential flag, and individual blocks.
3. A teacher can reorder, add, and remove blocks.
4. A teacher can publish, archive, and delete lessons.
5. A student can view a published lesson's blocks in order.
6. A student can track progress (percentage) as they navigate blocks.
7. A student can mark a lesson as complete.
8. Completing a lesson unlocks the next sequential lesson.
9. Completing all lessons in a course auto-completes the enrollment.
10. Version history records every save and is retrievable.
11. File uploads work via pre-signed URL for VIDEO, DOCUMENT, and IMAGE blocks.
12. All permission checks are enforced server-side.
13. Concurrent edit detection works (409 on stale writes).
14. All error responses follow the standard envelope format.
