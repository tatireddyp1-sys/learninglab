# Learning Lab — New User Guide

This guide explains how to sign in, what each role can do, and how to work through **users**, **custom roles**, **courses**, **lessons**, and **attaching lessons to courses**. Use it alongside your organization’s own policies and training.

---

## 1. Signing in

1. Open the app and go to the **Login** page.
2. Enter your **Tenant ID** (your administrator will tell you the correct value). If you are unsure, try the placeholder your team uses in development, e.g. `test-tenant-001`, only if that matches your environment.
3. Enter your **email** and **password**.
4. After a successful sign-in, you are taken to the **Dashboard**.

If multi-factor authentication (MFA) is enabled for your tenant, complete the extra step when prompted (for example, enter a code from your authenticator app).

---

## 2. The three roles at a glance

| Role | Typical purpose |
|------|-----------------|
| **Administrator** | Manage users, custom roles, and broad access across the platform. Oversee courses, enrollments, and settings your permissions allow. |
| **Teacher** (instructor) | Create and manage **courses** and **lessons**, publish content, manage rosters for courses you own or are assigned to, and track learner progress where permitted. |
| **Student** | Enroll in courses (when allowed), open **My courses**, launch the **lesson viewer**, and track **progress**. Cannot author platform-wide course catalogs unless given extra permissions. |

Exact buttons and pages depend on your **permissions** (including **custom roles**). The sections below describe the usual flows.

---

## 3. Administrator: creating a user

**Goal:** Add a person who can sign in with an email and password.

1. Sign in as an administrator (see [Reference test accounts](#7-reference-test-accounts) if your environment provides them).
2. Open **Admin → Users** (path: `/admin/users`).
3. Use **Create user** (or equivalent) and enter:
   - Email  
   - Password (follow your organization’s password rules)  
   - Role selection (e.g. student, teacher, admin — labels may match your API)
4. Save. The new user can sign in on the Login page using the same **Tenant ID** as everyone else in your organization.

**Notes**

- Some tenants require **invitations** or admin-only creation; the UI may say that new users must be invited — follow your admin’s process.
- If something fails, check the error message and confirm the email is not already in use.

---

## 4. Administrator: custom roles and assignment

**Goal:** Define a **custom role** (named policies/permissions) and assign it to users.

### 4.1 Create or edit a custom role

1. Go to **Admin → Roles** (path: `/admin/roles`).
2. **Create role** (or edit an existing one).
3. Set a **name** and, where the UI offers it, **permissions** or **policies** (allow/deny lists). Your backend defines what each permission means.
4. Save the role.

### 4.2 Assign a custom role to a user

1. Go to **Admin → Users** (`/admin/users`).
2. Open the user you want (or find them in the list).
3. Use the **role** or **custom role** controls to assign the custom role (and/or switch built-in roles), according to what your deployment supports.
4. Save. The user may need to **sign out and sign in again** to see menu items that depend on the new permissions.

**Tip:** Custom roles are often used to give teachers a subset of admin capabilities, or to give specialists access to enrollments or reporting without full admin access.

---

## 5. Courses and lessons — teacher / admin flows

### 5.1 Create a course

1. From the **Dashboard** or sidebar, open **Courses** (`/courses`).
2. Click **Create course** (`/courses/new`).
3. Enter **title** and **description**, then create the course.
4. Open the course to **publish** or **archive** if your permissions allow (from the course detail page).

### 5.2 Create a lesson

Lessons can be created **inside a course** or as **standalone** lessons first, then attached.

**Option A — From a course**

1. Open the course (`/courses/:courseId`).
2. Use **Add lesson** to open the **lesson builder** for that course (`/courses/:courseId/lessons/new` or similar).
3. Add **blocks** (text, video, quiz, files, etc.), then save/publish according to your workflow.

**Option B — Lesson builder hub**

1. Open **Lesson builder** from the sidebar (`/lesson-builder`).
2. Pick one of **your** courses and add or edit lessons for that course.

**Option C — Lessons library**

1. Open **Lessons** (`/lessons`) to see lessons you can manage.
2. Create a **new** lesson or edit an existing one.

### 5.3 Attach a standalone lesson to a course

**Goal:** Link a lesson that already exists (or was created without a course) to a **course**.

1. Go to **Lessons** (`/lessons`).
2. Find the lesson that should be attached.
3. Use **Attach** (or similar) and choose the **target course** from the list.
4. Confirm. The lesson should then appear in that course’s lesson list and ordering.

To **detach** a lesson from a course, use the **detach** action on the same page if your role allows it.

---

## 6. Student: learning flow

1. **Sign in** with a student account.
2. **My courses** (`/my-courses`) lists courses you are enrolled in (your teacher or admin enrolls you, or you self-enroll if the course allows it).
3. Open a course, then **Start learning** or open a lesson to launch the **lesson viewer** (`/viewer` with course and lesson parameters).
4. **Progress** (`/progress`) shows completion and analytics where available.

If you do not see a course, ask your instructor or admin to **enroll** you (often under **Students / Enrollments** for staff).

---

## 7. Reference test accounts

Your team can use the following accounts **only in environments where these users exist and passwords match** (for example a shared test or staging tenant). **Do not use weak or shared passwords in production.**

| Role | Email (user ID) | Password |
|------|-----------------|----------|
| **Administrator** | `admin@learninglab.com` | `AdminPass123` |
| **Teacher** | `pavan@gmail.com` | `Pavan@123` |
| **Student** | `nav@gmail.com` | `Naveen@123` |

Enter the **Tenant ID** your environment expects (often provided by your administrator) on the login form together with these credentials.

If sign-in fails, the account may not exist in your backend yet, or the tenant may differ — ask your administrator or use the user-creation flow in section 3.

---

## 8. Quick navigation map

| Area | Typical path |
|------|----------------|
| Dashboard | `/dashboard` |
| Courses | `/courses` |
| Create course | `/courses/new` |
| My courses (learner) | `/my-courses` |
| Lessons library | `/lessons` |
| Lesson builder hub | `/lesson-builder` |
| Enrollments (staff) | `/enrollments` |
| Progress & analytics | `/progress` |
| Admin — Users | `/admin/users` |
| Admin — Roles | `/admin/roles` |
| Profile | `/profile` |

---

## 9. Support

For API contracts and technical details, see `docs/LMS_API_CONTRACT_V1.md` and `docs/PROGRESS_API_CONTRACT_V1.md` in this repository. For product questions, contact your organization’s Learning Lab administrator.
