# Learning Lab LMS — API Contract Specification (v1)

**Status:** Draft contract (implementation-agnostic)  
**Base URL:** `https://{api-host}/api/v1`  
**Tenancy:** Every authenticated request is scoped by `tenantId` (JWT claim + row-level isolation).  
**Format:** JSON (`application/json`); file binaries use pre-signed URLs (not JSON bodies).  
**Versioning:** Path-based (`/api/v1/...`). Breaking changes require `/api/v2`.

---

## Normative rules (read first)

These rules apply to **every** endpoint unless explicitly overridden.

### Multi-tenancy

- All persisted resources include `tenantId`. The server **must** resolve the caller’s tenant from the JWT (`tid`) and **must** enforce `resource.tenantId === jwt.tid` on every read/write. Cross-tenant access attempts return **404** (preferred) or **403** (consistent per deployment); pick one policy and document it here as **404**.

### Authentication

- **Access token:** Bearer JWT (`Authorization: Bearer <accessToken>`).
- **Refresh token:** Opaque string; **only** for `POST /auth/refresh`, never as Bearer on resource APIs.

### Authorization precedence

When evaluating access: **explicit `permissions.deny` overrides allow**. If neither custom allow-list nor deny-list is used, fall back to primary `role` + resource ownership rules. **Documented invariant:** deny wins over allow for the same permission token.

### Response envelope (single standard)

**Success (always JSON body):**

```json
{
  "success": true,
  "data": {}
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": [
      { "field": "email", "code": "INVALID_FORMAT", "message": "Must be a valid email" }
    ],
    "requestId": "req_uuid"
  }
}
```

- Clients **must not** branch on `message` for logic; use `error.code` (and optional `details[].code`).
- **Delete:** Prefer **200** with `{ "success": true, "data": { "deleted": true } }` unless the API is explicitly no-body; do not mix 204 and envelope across the same API surface.

### IDs and timestamps

- **IDs:** UUID v4 for all new resources. Legacy prefixed IDs (`crs_*`, `les_*`) may exist during migration; clients must treat ids as opaque strings.
- **Timestamps:** ISO-8601 UTC (`date-time`).

### Pagination (list endpoints)

| Param   | Type    | Default | Rules        |
|---------|---------|---------|--------------|
| `page`  | integer | 1       | ≥ 1          |
| `limit` | integer | 20      | 1–100 (max)  |
| `sortBy`| string  | per resource | allow-list only |
| `order` | string  | `desc`  | `asc` \| `desc` |

**Success shape:**

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "limit": 20,
    "totalItems": 124,
    "totalPages": 7
  }
}
```

### Concurrency (optimistic locking)

- Use **integer `version`** on mutable aggregates (lesson, course). Optional **If-Match** / ETag may be added later.
- On mismatch: **409** with `error.code`: `CONCURRENT_MODIFICATION`.

### Rate limiting (baseline)

| Scope              | Suggested limit   |
|--------------------|-------------------|
| Authenticated      | 1200 req/min/user |
| `/auth/*`          | 20 req/min/IP     |
| Upload session mint| 30 req/min/user   |

**429** responses include `Retry-After` (seconds).

---

## 1. JWT access token (claims)

| Claim   | Type   | Description |
|---------|--------|-------------|
| `sub`   | string | `userId`    |
| `tid`   | string | `tenantId`  |
| `role`  | string | `admin` \| `teacher` \| `student` (primary role) |
| `perm`  | object | Optional `{ "allow": string[], "deny": string[] }` |
| `jti`   | string | Token id (revocation) |
| `iat`, `exp` | number | Unix seconds |

Refresh tokens are stored hashed server-side and rotated on refresh.

---

## 2. Roles and capabilities

**Primary roles:** `admin`, `teacher`, `student`.

**Fine-grained permissions** (aligns with app `LmsPermission`):  
`course:*`, `lesson:*`, `enrollment:*`, `progress:*`, `admin:*`, `quiz:*`, `assignment:*`, `file:*`, `audit:*`, `notification:*`.

**Resource ownership:** Teachers typically act on **courses they own** (`createdBy`) unless `course:edit_any` / admin. Production deployments should add **course staff membership** when co-instruction is required (separate schema; not in v1 contract detail).

---

## 3. HTTP status mapping

| Situation              | HTTP | `error.code` examples |
|------------------------|------|-------------------------|
| Validation             | 400  | `VALIDATION_ERROR`, `INVALID_ENUM`, `MISSING_FIELD` |
| Unauthorized           | 401  | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_TOKEN` |
| Forbidden              | 403  | `FORBIDDEN`, `INSUFFICIENT_PERMISSION` |
| Not found / hidden     | 404  | `NOT_FOUND` |
| Conflict               | 409  | `CONFLICT`, `CONCURRENT_MODIFICATION`, `ALREADY_ENROLLED` |
| Locked (sequential lesson) | 423 | `LESSON_LOCKED` (optional; see workflows) |
| Rate limit             | 429  | `RATE_LIMITED` |
| Server error           | 500  | `INTERNAL_ERROR` |

---

## 4. Data models (schemas)

### 4.1 User

```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "email": "string",
  "name": "string",
  "role": "admin|teacher|student",
  "customRoleId": "uuid|null",
  "status": "active|disabled",
  "permissionsAllow": ["string"],
  "permissionsDeny": ["string"],
  "createdAt": "date-time",
  "updatedAt": "date-time",
  "lastLoginAt": "date-time|null"
}
```

**Validation:** `email` normalized lowercase; unique per tenant; `name` 1–200 chars.

### 4.2 Tenant (minimal)

```json
{
  "tenantId": "uuid",
  "name": "string",
  "slug": "string",
  "status": "active|suspended",
  "createdAt": "date-time"
}
```

### 4.3 Course

```json
{
  "courseId": "uuid",
  "tenantId": "uuid",
  "title": "string",
  "description": "string",
  "status": "draft|published|archived",
  "createdBy": "uuid",
  "createdByName": "string|null",
  "createdAt": "date-time",
  "updatedAt": "date-time",
  "updatedBy": "uuid|null",
  "moduleOrder": ["uuid"],
  "metadata": { "tags": ["string"], "language": "en" }
}
```

**Note:** The current frontend uses flat `lessonOrder` on the course. This contract uses **Module** as the grouping unit; migration must map `lessonOrder` → modules or a default module.

### 4.4 Module (Course → Module → Lesson)

```json
{
  "moduleId": "uuid",
  "courseId": "uuid",
  "tenantId": "uuid",
  "title": "string",
  "description": "string",
  "order": 0,
  "lessonOrder": ["uuid"],
  "createdAt": "date-time",
  "updatedAt": "date-time"
}
```

### 4.5 Lesson

```json
{
  "lessonId": "uuid",
  "tenantId": "uuid",
  "courseId": "uuid",
  "moduleId": "uuid|null",
  "title": "string",
  "description": "string",
  "status": "draft|published|archived",
  "sequential": true,
  "order": 0,
  "blocks": [],
  "version": 1,
  "deleted": false,
  "createdAt": "date-time",
  "updatedAt": "date-time",
  "createdBy": "uuid",
  "updatedBy": "uuid"
}
```

### 4.6 Block (embedded)

```json
{
  "blockId": "uuid",
  "lessonId": "uuid",
  "type": "text|video|document|image|quiz|assignment",
  "order": 0,
  "title": "string|null",
  "textData": "string|null",
  "assetUrl": "string|null",
  "fileName": "string|null",
  "quizId": "uuid|null",
  "assignmentId": "uuid|null",
  "createdAt": "date-time",
  "updatedAt": "date-time"
}
```

**Compatibility:** Legacy UI may store embedded quiz JSON in `textData` for `quiz` blocks. Production should prefer **`quizId`** for attempts and grading.

### 4.7 Quiz

```json
{
  "quizId": "uuid",
  "tenantId": "uuid",
  "courseId": "uuid|null",
  "lessonId": "uuid|null",
  "moduleId": "uuid|null",
  "title": "string",
  "description": "string|null",
  "timeLimitSeconds": 0,
  "maxAttempts": 1,
  "shuffleQuestions": false,
  "passingScorePercent": 60,
  "status": "draft|published|archived",
  "questions": [],
  "createdBy": "uuid",
  "createdAt": "date-time",
  "updatedAt": "date-time"
}
```

**QuizQuestion**

```json
{
  "questionId": "uuid",
  "type": "mcq|multi_select|descriptive",
  "prompt": "string",
  "points": 1,
  "options": [{ "optionId": "uuid", "label": "string" }],
  "correctOptionIds": ["uuid"],
  "rubric": "string|null",
  "required": true
}
```

### 4.8 Quiz attempt

```json
{
  "attemptId": "uuid",
  "quizId": "uuid",
  "userId": "uuid",
  "attemptNumber": 1,
  "status": "in_progress|submitted|graded|expired",
  "startedAt": "date-time",
  "submittedAt": "date-time|null",
  "expiresAt": "date-time|null",
  "score": 0,
  "maxScore": 0,
  "passed": false,
  "answers": [
    {
      "questionId": "uuid",
      "selectedOptionIds": ["uuid"],
      "textAnswer": "string|null"
    }
  ]
}
```

### 4.9 Assignment

```json
{
  "assignmentId": "uuid",
  "tenantId": "uuid",
  "courseId": "uuid",
  "lessonId": "uuid|null",
  "moduleId": "uuid|null",
  "title": "string",
  "instructions": "string",
  "dueAt": "date-time|null",
  "allowLateSubmission": false,
  "maxFileSizeBytes": 52428800,
  "allowedMimeTypes": ["application/pdf"],
  "status": "draft|published|closed",
  "createdBy": "uuid",
  "createdAt": "date-time",
  "updatedAt": "date-time"
}
```

### 4.10 Assignment submission

```json
{
  "submissionId": "uuid",
  "assignmentId": "uuid",
  "userId": "uuid",
  "status": "draft|submitted|graded|returned",
  "submittedAt": "date-time|null",
  "textResponse": "string|null",
  "attachment": {
    "fileId": "uuid",
    "fileName": "string",
    "mimeType": "string",
    "sizeBytes": 0,
    "url": "string"
  },
  "grade": {
    "score": 0,
    "maxScore": 100,
    "feedback": "string|null",
    "gradedBy": "uuid|null",
    "gradedAt": "date-time|null"
  }
}
```

### 4.11 Enrollment

```json
{
  "enrollmentId": "uuid",
  "tenantId": "uuid",
  "courseId": "uuid",
  "userId": "uuid",
  "userName": "string|null",
  "status": "active|completed|dropped",
  "enrolledAt": "date-time",
  "completedAt": "date-time|null"
}
```

### 4.12 Lesson progress

```json
{
  "userId": "uuid",
  "courseId": "uuid",
  "lessonId": "uuid",
  "progressPercent": 0,
  "completed": false,
  "lastActivityAt": "date-time",
  "completedAt": "date-time|null"
}
```

### 4.13 File descriptor

```json
{
  "fileId": "uuid",
  "tenantId": "uuid",
  "ownerUserId": "uuid",
  "purpose": "lesson_asset|assignment_submission|profile|other",
  "mimeType": "string",
  "sizeBytes": 0,
  "storageKey": "string",
  "status": "pending_upload|scanning|active|rejected|deleted",
  "createdAt": "date-time"
}
```

### 4.14 Audit log entry

```json
{
  "auditId": "uuid",
  "tenantId": "uuid",
  "timestamp": "date-time",
  "actorUserId": "uuid",
  "actorName": "string|null",
  "action": "string",
  "resourceType": "string",
  "resourceId": "string|null",
  "ipAddress": "string|null",
  "userAgent": "string|null",
  "details": "string|null"
}
```

### 4.15 Notification

```json
{
  "notificationId": "uuid",
  "userId": "uuid",
  "type": "assignment_due|grade_posted|course_published|generic",
  "payload": {},
  "read": false,
  "createdAt": "date-time"
}
```

---

## 5. Validation (cross-cutting)

| Rule        | Applies to    | Rule |
|-------------|---------------|------|
| V-EMAIL     | `email`       | Required where applicable; unique per tenant |
| V-PASSWORD  | `password`    | Min length + complexity policy (deployment-defined) |
| V-TITLE     | titles        | 1–500 chars, trim |
| V-DESC      | descriptions  | 0–10000 chars |
| V-ENUM      | enums         | Reject unknown → `INVALID_ENUM` |
| V-UUID      | path ids      | Valid UUID when using UUID mode |
| V-VERSION   | lessons/courses | Optimistic lock via `version` |

---

## 6. Endpoint catalog

Each entry uses the standard envelope. **Roles** lists who may call the endpoint **subject to** tenant match and ownership rules.

### 6.1 Tenancy discovery (recommended)

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/tenants/by-slug/{slug}` | Resolve `tenantId` for login UI | Public |
| GET | `/tenants/current` | Resolve tenant from host header (if applicable) | Public |

### 6.2 Auth

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| POST | `/auth/register` | Sign up | Public (if enabled) |
| POST | `/auth/login` | Issue tokens | Public |
| POST | `/auth/refresh` | Rotate access (and optionally refresh) token | Public (refresh body) |
| POST | `/auth/logout` | Revoke refresh / blacklist access `jti` | Authenticated |
| POST | `/auth/mfa/setup` | Start MFA enrollment | Authenticated |
| POST | `/auth/mfa/verify` | Verify MFA code | Authenticated / challenge |

**POST `/auth/login` — request**

```json
{
  "tenantId": "uuid",
  "email": "string",
  "password": "string",
  "mfaCode": "string|null"
}
```

**POST `/auth/login` — success data**

```json
{
  "accessToken": "jwt",
  "refreshToken": "opaque",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "userId": "uuid",
    "tenantId": "uuid",
    "email": "string",
    "name": "string",
    "role": "student",
    "permissions": { "allow": ["course:enroll"], "deny": [] }
  }
}
```

### 6.3 Users

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/users` | List users (paginated, filter) | admin |
| POST | `/users` | Create user | admin |
| GET | `/users/{userId}` | Get user | self, admin |
| PATCH | `/users/{userId}` | Update user | self (limited), admin |
| DELETE | `/users/{userId}` | Soft-delete / disable | admin |
| POST | `/users/{userId}/role` | Assign role / custom role / allow-deny | admin |
| GET | `/users/me` | Current user + effective permissions | Authenticated |

**POST `/users` — request**

```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "role": "admin|teacher|student",
  "sendInvite": false
}
```

### 6.4 Roles (custom)

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/roles` | List custom roles | admin |
| POST | `/roles` | Create role | admin |
| PATCH | `/roles/{roleId}` | Update role | admin |
| DELETE | `/roles/{roleId}` | Delete role (if unused) | admin |

### 6.5 Courses

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/courses` | List courses | Authenticated (scoped) |
| POST | `/courses` | Create course | admin, teacher |
| GET | `/courses/{courseId}` | Get course | Enrolled / staff / admin |
| PATCH | `/courses/{courseId}` | Update | Owner teacher, admin |
| DELETE | `/courses/{courseId}` | Delete | Owner, admin |
| POST | `/courses/{courseId}/publish` | Publish | Owner, admin |
| POST | `/courses/{courseId}/archive` | Archive | Owner, admin |
| GET | `/courses/{courseId}/summary` | Dashboard summary | Owner teacher, admin |

### 6.6 Modules

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/courses/{courseId}/modules` | List modules | Course read |
| POST | `/courses/{courseId}/modules` | Create module | Owner teacher, admin |
| GET | `/modules/{moduleId}` | Get module | Course read |
| PATCH | `/modules/{moduleId}` | Update module | Owner teacher, admin |
| DELETE | `/modules/{moduleId}` | Delete (optional reassign) | Owner teacher, admin |
| PATCH | `/modules/{moduleId}/lesson-order` | Reorder lessons | Owner teacher, admin |

### 6.7 Lessons and blocks

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/lessons` | List lessons (`courseId`, `moduleId`, `includeDeleted`) | Scoped |
| POST | `/lessons` | Create lesson | Owner teacher, admin |
| GET | `/lessons/{lessonId}` | Get lesson (see workflow: locked) | Enrolled / staff |
| PATCH | `/lessons/{lessonId}` | Update (`version` for concurrency) | Owner teacher, admin |
| DELETE | `/lessons/{lessonId}` | Soft-delete | Staff |
| POST | `/lessons/{lessonId}/publish` | Publish lesson | Staff |
| POST | `/lessons/{lessonId}/archive` | Archive lesson | Staff |
| POST | `/lessons/{lessonId}/move` | Move between modules / order | Staff |
| POST | `/lessons/{lessonId}/blocks` | Add block | Staff |
| PATCH | `/lessons/{lessonId}/blocks/{blockId}` | Update block | Staff |
| DELETE | `/lessons/{lessonId}/blocks/{blockId}` | Remove block | Staff |
| PATCH | `/lessons/{lessonId}/blocks/reorder` | Reorder blocks | Staff |
| GET | `/lessons/{lessonId}/versions` | Version history | Staff |
| POST | `/lessons/{lessonId}/restore-version` | Restore snapshot | Staff |

**GET `/lessons/{lessonId}` — when sequential lock applies**

Prefer **200** with:

```json
{
  "success": true,
  "data": {
    "lesson": {},
    "access": {
      "allowed": false,
      "reason": "SEQUENTIAL_LOCK",
      "unlockAfterLessonId": "uuid"
    }
  }
}
```

Alternatively **423** with the same `error.code` `LESSON_LOCKED` and structured `details`. **Choose one globally.**

### 6.8 Files (S3-compatible)

**Path format (logical key examples)**

- Lessons: `tenants/{tenantId}/courses/{courseId}/lessons/{lessonId}/{fileId}-{safeName}`
- Submissions: `tenants/{tenantId}/assignments/{assignmentId}/submissions/{userId}/{submissionId}-{safeName}`

**Allowed types / sizes (defaults; per-assignment may override)**

| Purpose   | MIME (examples) | Max size |
|-----------|-----------------|----------|
| Video     | video/mp4, video/webm | 2 GB (multipart recommended) |
| Document  | pdf, docx | 50 MB |
| Image     | png, jpeg, webp, gif | 25 MB |

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| POST | `/files/upload-sessions` | Mint pre-signed PUT / initiate multipart | Authenticated + purpose |
| POST | `/files/{fileId}/complete` | Confirm upload (ETag/size/checksum policy TBD) | Owner |
| GET | `/files/{fileId}` | Metadata + short-lived GET URL | Authorized |
| POST | `/files/validate` | Pre-check MIME/size | Authenticated |

### 6.9 Quizzes

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| POST | `/quizzes` | Create quiz | Staff |
| GET | `/quizzes/{quizId}` | Get quiz (`includeAnswers` staff only) | Staff / student (student: no answers) |
| PATCH | `/quizzes/{quizId}` | Update | Staff |
| DELETE | `/quizzes/{quizId}` | Delete/archive | Staff |
| POST | `/quizzes/{quizId}/attempts` | Start attempt | Enrolled student |
| PATCH | `/quiz-attempts/{attemptId}` | Autosave answers | Owner student |
| POST | `/quiz-attempts/{attemptId}/submit` | Submit | Owner student |
| GET | `/quiz-attempts/{attemptId}` | Get attempt result | Owner / staff |
| GET | `/quizzes/{quizId}/results` | Gradebook export | Staff |
| POST | `/quiz-attempts/{attemptId}/grade` | Manual grade (descriptive) | Staff |

### 6.10 Assignments

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| POST | `/assignments` | Create | Staff |
| GET | `/assignments/{assignmentId}` | Get | Staff / enrolled |
| PATCH | `/assignments/{assignmentId}` | Update | Staff |
| DELETE | `/assignments/{assignmentId}` | Delete | Staff |
| GET | `/courses/{courseId}/assignments` | List by course | Scoped |
| POST | `/assignments/{assignmentId}/submissions` | Create/update draft | Enrolled student |
| POST | `/assignment-submissions/{submissionId}/submit` | Finalize | Enrolled student |
| PATCH | `/assignment-submissions/{submissionId}/grade` | Grade | Staff |
| GET | `/assignment-submissions/{submissionId}` | Get submission | Submitter / staff |
| GET | `/assignments/{assignmentId}/submissions` | List submissions | Staff |

### 6.11 Progress

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/me/progress` | Current user progress (`?courseId=`) | Authenticated |
| POST | `/progress/lessons/{lessonId}/start` | Start (`courseId` body) | Enrolled student |
| PATCH | `/progress/lessons/{lessonId}` | Update % (`courseId`, `progressPercent`) | Enrolled student |
| POST | `/progress/lessons/{lessonId}/complete` | Mark complete (`courseId`) | Enrolled student |
| GET | `/courses/{courseId}/analytics/progress` | Instructor summary | Owner teacher, admin |

**Rule:** `PATCH` at `progressPercent: 100` is equivalent to **complete** for automation, or restrict completion to **POST …/complete** only — **pick one policy**.

### 6.12 Enrollments

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/enrollments` | List (`courseId`, `userId`, `status`) | Scoped |
| POST | `/enrollments` | Enroll (`userId` optional = self) | Authenticated |
| DELETE | `/enrollments/{enrollmentId}` | Drop | Self / staff |
| PATCH | `/enrollments/{enrollmentId}` | Status | Staff / self per policy |
| GET | `/courses/{courseId}/roster` | Roster | Staff |

### 6.13 Audit

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/audit-logs` | Paginated, filter by action/user/date | admin |

### 6.14 Notifications

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/notifications` | List | Authenticated |
| PATCH | `/notifications/{notificationId}/read` | Mark read | Owner |
| POST | `/notifications/mark-all-read` | Mark all | Owner |

### 6.15 Search

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/search` | `q`, `types`, pagination | Authenticated (scoped) |

### 6.16 Bulk (optional)

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| POST | `/enrollments/bulk` | Bulk enroll | Staff |
| POST | `/users/bulk-disable` | Bulk disable | admin |
| POST | `/lessons/bulk-archive` | Bulk archive | Staff |

### 6.17 System

| Method | Path | Description | Roles |
|--------|------|-------------|--------|
| GET | `/health` | Liveness | Public |
| GET | `/ready` | Readiness (DB, etc.) | Internal |

---

## 7. Workflow behavior

### 7.1 Lesson lifecycle

1. Create lesson `draft` → add blocks → upload assets.
2. Publish lesson when course policy allows; students typically only see `published` lessons on `published` courses (policy matrix should be fixed per product).
3. **Sequential:** if `sequential` and prior lesson incomplete → return locked contract (§6.7).
4. Soft-delete excludes from lists unless `includeDeleted` (staff).

### 7.2 File upload

1. `POST /files/upload-sessions` → `uploadUrl`, `fileId`.
2. Client PUTs to object storage.
3. `POST /files/{fileId}/complete` → verify object, scan, `status: active`.
4. Reference `fileId` / URL on block or submission.

### 7.3 Quiz attempt

1. Start attempt → server enforces `maxAttempts`, enrollment, `timeLimitSeconds` (`expiresAt` on attempt).
2. Autosave via `PATCH /quiz-attempts/{id}`.
3. Submit → auto-grade objective items; queue descriptive grading.

### 7.4 Assignment

1. Draft submission allowed until due (unless late allowed).
2. Final submit locks; grading updates submission.

### 7.5 Enrollment

- Self-enroll: course `published`, caller has enroll permission.
- Staff enroll others: must manage that course (owner/admin).
- Completing all lessons may set enrollment `completed` — define behavior when new lessons are added later (product policy).

---

## 8. Security

- **RBAC + tenant isolation** on every handler.
- **Input validation** on all writes.
- **File:** allow-list MIME, max size, scan pipeline, short-lived URLs.
- **Audit** on admin and destructive actions.

---

## 9. Non-goals (v1)

- LTI / external LMS interoperability
- Payment / billing
- Full i18n of error messages
- Webhooks (recommended as v1.1)

---

## 10. Coverage summary

| Item | Value |
|------|--------|
| Endpoint rows (§6 tables, approximate) | 90+ |
| Modules covered | Auth, users, roles, tenants, courses, modules, lessons, files, quizzes, assignments, progress, enrollments, audit, notifications, search, bulk, system |
| Frontend alignment | Maps from mock `auth`, `admin`, `courses`, `lessons`, `enrollments`, `progress` actions; adds REST paths, modules, first-class quiz/assignment, tenant discovery |

---

## 11. Document history

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-18 | Initial consolidated contract document |
