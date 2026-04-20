/**
 * Seed data for every LMS module.
 *
 * On first load (or when storage is corrupt) the mock layer seeds
 * this data into localStorage so the app looks pre-populated.
 * After that every change is persisted to localStorage directly.
 *
 * ► To add a real backend later, delete this file and point
 *   `learningLabApi.ts` at live endpoints.
 */

import { getItem, setItem, seedIfMissing, STORAGE_KEYS } from "@/lib/mockStorage";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/*  Users                                                             */
/* ------------------------------------------------------------------ */

export interface StoredUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  roleId: "ADMIN" | "TEACHER" | "STUDENT";
  status: "ACTIVE" | "DISABLED";
  customRoleId?: string | null;
  permissionsAllow: string[];
  permissionsDeny: string[];
  createdAt: string;
  /** Set when user was synthesized from a live JWT (not in mock sessions) — mock modules may relax local-only checks */
  resolvedViaJwt?: boolean;
}

const SEED_USERS: StoredUser[] = [
  {
    userId: "usr_admin_001",
    tenantId: "t1",
    email: "admin@learninglab.com",
    name: "Sarah Chen",
    roleId: "ADMIN",
    status: "ACTIVE",
    permissionsAllow: ["*:*"],
    permissionsDeny: [],
    createdAt: daysAgo(90),
  },
  {
    userId: "usr_teacher_001",
    tenantId: "t1",
    email: "prof.smith@learninglab.com",
    name: "Prof. Robert Smith",
    roleId: "TEACHER",
    status: "ACTIVE",
    permissionsAllow: [
      "courses:create", "courses:edit_own", "courses:delete_own", "courses:publish_own", "courses:enroll",
      "lessons:create", "lessons:edit", "lessons:view", "lessons:delete",
      "enrollments:manage", "progress:view_course", "progress:view_own",
      "roles:manage",
    ],
    permissionsDeny: [],
    createdAt: daysAgo(80),
  },
  {
    userId: "usr_teacher_002",
    tenantId: "t1",
    email: "dr.jones@learninglab.com",
    name: "Dr. Emily Jones",
    roleId: "TEACHER",
    status: "ACTIVE",
    permissionsAllow: [
      "courses:create", "courses:edit_own", "courses:delete_own", "courses:publish_own", "courses:enroll",
      "lessons:create", "lessons:edit", "lessons:view", "lessons:delete",
      "enrollments:manage", "progress:view_course", "progress:view_own",
      "roles:manage",
    ],
    permissionsDeny: [],
    createdAt: daysAgo(75),
  },
  {
    userId: "usr_student_001",
    tenantId: "t1",
    email: "alex@student.edu",
    name: "Alex Thompson",
    roleId: "STUDENT",
    status: "ACTIVE",
    permissionsAllow: ["courses:enroll", "lessons:view", "progress:view_own"],
    permissionsDeny: [],
    createdAt: daysAgo(60),
  },
  {
    userId: "usr_student_002",
    tenantId: "t1",
    email: "maria@student.edu",
    name: "Maria Garcia",
    roleId: "STUDENT",
    status: "ACTIVE",
    permissionsAllow: ["courses:enroll", "lessons:view", "progress:view_own"],
    permissionsDeny: [],
    createdAt: daysAgo(55),
  },
  {
    userId: "usr_student_003",
    tenantId: "t1",
    email: "james@student.edu",
    name: "James Wilson",
    roleId: "STUDENT",
    status: "ACTIVE",
    permissionsAllow: ["courses:enroll", "lessons:view", "progress:view_own"],
    permissionsDeny: [],
    createdAt: daysAgo(50),
  },
];

const SEED_PASSWORDS: Record<string, string> = {
  "admin@learninglab.com": "password123",
  "prof.smith@learninglab.com": "password123",
  "dr.jones@learninglab.com": "password123",
  "alex@student.edu": "password123",
  "maria@student.edu": "password123",
  "james@student.edu": "password123",
};

/* ------------------------------------------------------------------ */
/*  Courses                                                           */
/* ------------------------------------------------------------------ */

export interface StoredCourse {
  courseId: string;
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DELETED";
  createdBy: string;
  createdByName: string;
  /** Defaults to [createdBy] in list/create when omitted */
  teacherIds?: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  lessonOrder: string[];
}

const SEED_COURSES: StoredCourse[] = [
  {
    courseId: "crs_001",
    title: "Introduction to Web Development",
    description: "Learn the fundamentals of building modern websites including HTML, CSS, and JavaScript. This comprehensive course takes you from zero to deploying your first website.",
    status: "PUBLISHED",
    createdBy: "usr_teacher_001",
    createdByName: "Prof. Robert Smith",
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
    updatedBy: "usr_teacher_001",
    lessonOrder: ["les_001", "les_002", "les_003"],
  },
  {
    courseId: "crs_002",
    title: "Data Science Fundamentals",
    description: "Explore the world of data science with Python. Cover statistics, data manipulation, visualization, and introductory machine learning concepts.",
    status: "PUBLISHED",
    createdBy: "usr_teacher_002",
    createdByName: "Dr. Emily Jones",
    createdAt: daysAgo(45),
    updatedAt: daysAgo(10),
    updatedBy: "usr_teacher_002",
    lessonOrder: ["les_004", "les_005"],
  },
  {
    courseId: "crs_003",
    title: "Advanced React Patterns",
    description: "Master advanced React patterns including compound components, render props, custom hooks, and performance optimization techniques.",
    status: "DRAFT",
    createdBy: "usr_teacher_001",
    createdByName: "Prof. Robert Smith",
    createdAt: daysAgo(15),
    updatedAt: daysAgo(3),
    updatedBy: "usr_teacher_001",
    lessonOrder: ["les_006"],
  },
  {
    courseId: "crs_004",
    title: "Machine Learning 101",
    description: "A gentle introduction to machine learning algorithms, model training, evaluation metrics, and real-world applications using scikit-learn.",
    status: "DRAFT",
    createdBy: "usr_teacher_002",
    createdByName: "Dr. Emily Jones",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
    updatedBy: "usr_teacher_002",
    lessonOrder: [],
  },
];

/* ------------------------------------------------------------------ */
/*  Lessons & Blocks                                                  */
/* ------------------------------------------------------------------ */

export interface StoredBlock {
  blockId: string;
  type: "TEXT" | "VIDEO" | "QUIZ" | "DOCUMENT" | "IMAGE";
  title: string;
  textData?: string;
  quizData?: unknown;
  assetUrl?: string;
  fileName?: string;
  s3Bucket?: string;
  s3Key?: string;
  order: number;
}

export interface StoredLesson {
  lessonId: string;
  courseId: string;
  title: string;
  description: string;
  blocks: StoredBlock[];
  sequential: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

const SEED_LESSONS: StoredLesson[] = [
  {
    lessonId: "les_001",
    courseId: "crs_001",
    title: "HTML & CSS Basics",
    description: "Learn the building blocks of every web page — semantic HTML elements and CSS styling fundamentals.",
    sequential: true,
    deleted: false,
    createdAt: daysAgo(58),
    updatedAt: daysAgo(20),
    updatedBy: "usr_teacher_001",
    version: 3,
    blocks: [
      { blockId: "blk_001", type: "TEXT", title: "What is HTML?", textData: "HTML (HyperText Markup Language) is the standard language for creating web pages. It describes the structure of a web page using a series of elements that tell the browser how to display content.\n\n## Key Concepts\n\n- **Elements** are defined by tags like `<h1>`, `<p>`, `<div>`\n- **Attributes** provide additional information: `class`, `id`, `href`\n- **Semantic tags** like `<header>`, `<nav>`, `<main>` improve accessibility\n\n```html\n<!DOCTYPE html>\n<html>\n  <head><title>My Page</title></head>\n  <body>\n    <h1>Hello World</h1>\n  </body>\n</html>\n```", order: 0 },
      { blockId: "blk_002", type: "IMAGE", title: "HTML Document Structure", assetUrl: "https://picsum.photos/seed/htmlstructure/800/400", fileName: "html-structure.png", order: 1 },
      { blockId: "blk_003", type: "QUIZ", title: "HTML Basics Quiz", textData: JSON.stringify({ questions: [{ id: "q1", text: "Which tag is used for the largest heading?", options: [{ id: "a", text: "<heading>" }, { id: "b", text: "<h6>" }, { id: "c", text: "<h1>" }, { id: "d", text: "<head>" }], correctId: "c", explanation: "The <h1> tag defines the most important (largest) heading on a page." }, { id: "q2", text: "What does HTML stand for?", options: [{ id: "a", text: "Hyper Trainer Marking Language" }, { id: "b", text: "HyperText Markup Language" }, { id: "c", text: "HyperText Marketing Language" }, { id: "d", text: "High Tech Modern Language" }], correctId: "b", explanation: "HTML stands for HyperText Markup Language — the standard for web documents." }, { id: "q3", text: "Which element is used to create a paragraph?", options: [{ id: "a", text: "<para>" }, { id: "b", text: "<text>" }, { id: "c", text: "<p>" }, { id: "d", text: "<paragraph>" }], correctId: "c", explanation: "The <p> tag defines a paragraph in HTML." }] }), order: 2 },
    ],
  },
  {
    lessonId: "les_002",
    courseId: "crs_001",
    title: "JavaScript Fundamentals",
    description: "Discover the programming language that powers interactivity on the web.",
    sequential: true,
    deleted: false,
    createdAt: daysAgo(55),
    updatedAt: daysAgo(18),
    updatedBy: "usr_teacher_001",
    version: 2,
    blocks: [
      { blockId: "blk_004", type: "TEXT", title: "Variables and Data Types", textData: "JavaScript has three ways to declare variables:\n\n- `const` — block-scoped, cannot be reassigned\n- `let` — block-scoped, can be reassigned\n- `var` — function-scoped (legacy, avoid)\n\n### Primitive types\n`string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`\n\n```js\nconst name = 'Alice';\nlet score = 42;\nconst isActive = true;\n```", order: 0 },
      { blockId: "blk_005", type: "VIDEO", title: "JavaScript in 10 Minutes", assetUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", fileName: "js-intro.mp4", order: 1 },
    ],
  },
  {
    lessonId: "les_003",
    courseId: "crs_001",
    title: "Building Your First Website",
    description: "Put it all together — build and deploy a personal portfolio site.",
    sequential: true,
    deleted: false,
    createdAt: daysAgo(50),
    updatedAt: daysAgo(12),
    updatedBy: "usr_teacher_001",
    version: 1,
    blocks: [
      { blockId: "blk_006", type: "TEXT", title: "Project Setup", textData: "We'll create a portfolio site with three pages: Home, About, and Projects.\n\n### Step 1: Create the folder structure\n```\nportfolio/\n  index.html\n  about.html\n  projects.html\n  css/\n    styles.css\n  js/\n    main.js\n```\n\n### Step 2: Add the HTML boilerplate\nStart with the home page and add navigation links to each page.", order: 0 },
      { blockId: "blk_007", type: "DOCUMENT", title: "Starter Template", assetUrl: "https://picsum.photos/seed/starterzip/200/200", fileName: "portfolio-starter.zip", order: 1 },
    ],
  },
  {
    lessonId: "les_004",
    courseId: "crs_002",
    title: "Introduction to Python",
    description: "Get started with Python programming — syntax, data types, and control flow.",
    sequential: true,
    deleted: false,
    createdAt: daysAgo(42),
    updatedAt: daysAgo(15),
    updatedBy: "usr_teacher_002",
    version: 2,
    blocks: [
      { blockId: "blk_008", type: "TEXT", title: "Why Python?", textData: "Python is one of the most popular programming languages in the world, especially for data science and machine learning.\n\n### Advantages\n- Clean, readable syntax\n- Massive ecosystem of libraries (NumPy, Pandas, scikit-learn)\n- Great for prototyping and production\n\n```python\n# Hello World in Python\nprint('Hello, Data Science!')\n\n# Variables\nname = 'Alice'\nage = 28\nscores = [95, 87, 92, 88]\naverage = sum(scores) / len(scores)\nprint(f'{name} has an average score of {average}')\n```", order: 0 },
      { blockId: "blk_009", type: "VIDEO", title: "Python Setup Guide", assetUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", fileName: "python-setup.mp4", order: 1 },
    ],
  },
  {
    lessonId: "les_005",
    courseId: "crs_002",
    title: "Working with Data",
    description: "Learn to load, clean, and visualize data using Pandas and Matplotlib.",
    sequential: true,
    deleted: false,
    createdAt: daysAgo(38),
    updatedAt: daysAgo(10),
    updatedBy: "usr_teacher_002",
    version: 1,
    blocks: [
      { blockId: "blk_010", type: "TEXT", title: "Pandas DataFrames", textData: "Pandas is the Swiss Army knife for data manipulation in Python.\n\n```python\nimport pandas as pd\n\ndf = pd.read_csv('sales.csv')\nprint(df.head())\nprint(df.describe())\n\n# Filter rows\nhigh_sales = df[df['revenue'] > 10000]\n\n# Group and aggregate\nby_region = df.groupby('region')['revenue'].sum()\n```", order: 0 },
      { blockId: "blk_011", type: "IMAGE", title: "Sample Data Visualization", assetUrl: "https://picsum.photos/seed/dataviz/800/400", fileName: "data-viz.png", order: 1 },
      { blockId: "blk_011b", type: "QUIZ", title: "Data Handling Quiz", textData: JSON.stringify({ questions: [{ id: "q1", text: "Which Python library is most commonly used for data manipulation?", options: [{ id: "a", text: "Flask" }, { id: "b", text: "Pandas" }, { id: "c", text: "Django" }, { id: "d", text: "PyGame" }], correctId: "b", explanation: "Pandas is the go-to library for data manipulation and analysis in Python." }, { id: "q2", text: "What does df.head() return?", options: [{ id: "a", text: "The last 5 rows" }, { id: "b", text: "Column names only" }, { id: "c", text: "The first 5 rows" }, { id: "d", text: "Summary statistics" }], correctId: "c", explanation: "df.head() returns the first 5 rows of the DataFrame by default." }] }), order: 2 },
    ],
  },
  {
    lessonId: "les_006",
    courseId: "crs_003",
    title: "Component Design Patterns",
    description: "Explore compound components, render props, and the provider pattern in React.",
    sequential: false,
    deleted: false,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(3),
    updatedBy: "usr_teacher_001",
    version: 1,
    blocks: [
      { blockId: "blk_012", type: "TEXT", title: "Compound Components", textData: "The compound component pattern lets related components share implicit state.\n\n```tsx\n<Tabs defaultValue='tab1'>\n  <TabList>\n    <Tab value='tab1'>General</Tab>\n    <Tab value='tab2'>Settings</Tab>\n  </TabList>\n  <TabPanel value='tab1'>General content</TabPanel>\n  <TabPanel value='tab2'>Settings content</TabPanel>\n</Tabs>\n```\n\nThe `Tabs` parent manages which tab is active, while child components read that state through context — no prop drilling required.", order: 0 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Enrollments                                                       */
/* ------------------------------------------------------------------ */

export interface StoredEnrollment {
  enrollmentId: string;
  courseId: string;
  userId: string;
  userName: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  enrolledAt: string;
  completedAt?: string;
}

const SEED_ENROLLMENTS: StoredEnrollment[] = [
  { enrollmentId: "enr_001", courseId: "crs_001", userId: "usr_student_001", userName: "Alex Thompson", status: "ACTIVE", enrolledAt: daysAgo(40) },
  { enrollmentId: "enr_002", courseId: "crs_002", userId: "usr_student_001", userName: "Alex Thompson", status: "ACTIVE", enrolledAt: daysAgo(35) },
  { enrollmentId: "enr_003", courseId: "crs_001", userId: "usr_student_002", userName: "Maria Garcia", status: "COMPLETED", enrolledAt: daysAgo(50), completedAt: daysAgo(8) },
  { enrollmentId: "enr_004", courseId: "crs_002", userId: "usr_student_003", userName: "James Wilson", status: "ACTIVE", enrolledAt: daysAgo(30) },
  { enrollmentId: "enr_005", courseId: "crs_001", userId: "usr_student_003", userName: "James Wilson", status: "ACTIVE", enrolledAt: daysAgo(28) },
];

/* ------------------------------------------------------------------ */
/*  Lesson Completions / Progress                                     */
/* ------------------------------------------------------------------ */

export interface StoredCompletion {
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  progress: number;
  completedAt?: string;
  lastActivityAt: string;
}

const SEED_COMPLETIONS: StoredCompletion[] = [
  // Alex — Web Dev: 1 done, 1 in-progress
  { userId: "usr_student_001", courseId: "crs_001", lessonId: "les_001", completed: true, progress: 100, completedAt: daysAgo(30), lastActivityAt: daysAgo(30) },
  { userId: "usr_student_001", courseId: "crs_001", lessonId: "les_002", completed: false, progress: 60, lastActivityAt: daysAgo(5) },
  // Alex — Data Science: lesson 1 done, lesson 2 started
  { userId: "usr_student_001", courseId: "crs_002", lessonId: "les_004", completed: true, progress: 100, completedAt: daysAgo(20), lastActivityAt: daysAgo(20) },
  { userId: "usr_student_001", courseId: "crs_002", lessonId: "les_005", completed: false, progress: 40, lastActivityAt: daysAgo(2) },
  // Maria — Web Dev: all 3 lessons done (course completed)
  { userId: "usr_student_002", courseId: "crs_001", lessonId: "les_001", completed: true, progress: 100, completedAt: daysAgo(40), lastActivityAt: daysAgo(40) },
  { userId: "usr_student_002", courseId: "crs_001", lessonId: "les_002", completed: true, progress: 100, completedAt: daysAgo(25), lastActivityAt: daysAgo(25) },
  { userId: "usr_student_002", courseId: "crs_001", lessonId: "les_003", completed: true, progress: 100, completedAt: daysAgo(8), lastActivityAt: daysAgo(8) },
  // James — Data Science: lesson 1 done, lesson 2 in progress
  { userId: "usr_student_003", courseId: "crs_002", lessonId: "les_004", completed: true, progress: 100, completedAt: daysAgo(22), lastActivityAt: daysAgo(22) },
  { userId: "usr_student_003", courseId: "crs_002", lessonId: "les_005", completed: false, progress: 35, lastActivityAt: daysAgo(4) },
  // James — Web Dev: lesson 1 done, lesson 2 in progress
  { userId: "usr_student_003", courseId: "crs_001", lessonId: "les_001", completed: true, progress: 100, completedAt: daysAgo(20), lastActivityAt: daysAgo(20) },
  { userId: "usr_student_003", courseId: "crs_001", lessonId: "les_002", completed: false, progress: 45, lastActivityAt: daysAgo(3) },
];

/* ------------------------------------------------------------------ */
/*  Custom Roles                                                      */
/* ------------------------------------------------------------------ */

export interface StoredRole {
  roleId: string;
  displayName: string;
  roleName: string;
  status: "ACTIVE";
  isSystem: boolean;
  policies: { allow: string[]; deny: string[] };
  createdAt: string;
  updatedAt: string;
}

const SEED_ROLES: StoredRole[] = [
  {
    roleId: "CONTENT_REVIEWER",
    displayName: "Content Reviewer",
    roleName: "Reviews courses and lessons before publishing",
    status: "ACTIVE",
    isSystem: false,
    policies: {
      allow: ["courses:enroll", "lessons:view", "progress:view_course", "progress:view_own"],
      deny: [],
    },
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  },
  {
    roleId: "TEACHING_ASSISTANT",
    displayName: "Teaching Assistant",
    roleName: "Supports teachers with course management",
    status: "ACTIVE",
    isSystem: false,
    policies: {
      allow: [
        "courses:create", "courses:edit_own", "courses:publish_own", "courses:enroll",
        "lessons:create", "lessons:edit", "lessons:view",
        "enrollments:manage", "progress:view_course", "progress:view_own",
      ],
      deny: [],
    },
    createdAt: daysAgo(25),
    updatedAt: daysAgo(12),
  },
];

/* ------------------------------------------------------------------ */
/*  Audit Logs                                                        */
/* ------------------------------------------------------------------ */

export interface StoredAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  resourceId?: string;
  details: string;
  ipAddress: string;
}

const SEED_AUDIT: StoredAuditEntry[] = [
  { id: "aud_001", timestamp: daysAgo(90), userId: "usr_admin_001", userName: "Sarah Chen", action: "SYSTEM_INIT", module: "system", details: "Platform initialized — admin account created", ipAddress: "10.0.1.1" },
  { id: "aud_002", timestamp: daysAgo(80), userId: "usr_admin_001", userName: "Sarah Chen", action: "USER_CREATED", module: "admin", resourceId: "usr_teacher_001", details: "Created teacher account for Prof. Robert Smith", ipAddress: "10.0.1.1" },
  { id: "aud_003", timestamp: daysAgo(75), userId: "usr_admin_001", userName: "Sarah Chen", action: "USER_CREATED", module: "admin", resourceId: "usr_teacher_002", details: "Created teacher account for Dr. Emily Jones", ipAddress: "10.0.1.1" },
  { id: "aud_004", timestamp: daysAgo(60), userId: "usr_teacher_001", userName: "Prof. Robert Smith", action: "COURSE_CREATED", module: "courses", resourceId: "crs_001", details: "Created course: Introduction to Web Development", ipAddress: "192.168.1.10" },
  { id: "aud_005", timestamp: daysAgo(58), userId: "usr_teacher_001", userName: "Prof. Robert Smith", action: "LESSON_CREATED", module: "lessons", resourceId: "les_001", details: "Created lesson: HTML & CSS Basics", ipAddress: "192.168.1.10" },
  { id: "aud_006", timestamp: daysAgo(55), userId: "usr_teacher_001", userName: "Prof. Robert Smith", action: "LESSON_CREATED", module: "lessons", resourceId: "les_002", details: "Created lesson: JavaScript Fundamentals", ipAddress: "192.168.1.10" },
  { id: "aud_007", timestamp: daysAgo(50), userId: "usr_teacher_001", userName: "Prof. Robert Smith", action: "COURSE_PUBLISHED", module: "courses", resourceId: "crs_001", details: "Published course: Introduction to Web Development", ipAddress: "192.168.1.10" },
  { id: "aud_008", timestamp: daysAgo(45), userId: "usr_teacher_002", userName: "Dr. Emily Jones", action: "COURSE_CREATED", module: "courses", resourceId: "crs_002", details: "Created course: Data Science Fundamentals", ipAddress: "172.16.0.5" },
  { id: "aud_009", timestamp: daysAgo(40), userId: "usr_student_001", userName: "Alex Thompson", action: "ENROLLMENT_CREATED", module: "enrollments", resourceId: "enr_001", details: "Enrolled in Introduction to Web Development", ipAddress: "203.0.113.42" },
  { id: "aud_010", timestamp: daysAgo(35), userId: "usr_student_001", userName: "Alex Thompson", action: "ENROLLMENT_CREATED", module: "enrollments", resourceId: "enr_002", details: "Enrolled in Data Science Fundamentals", ipAddress: "203.0.113.42" },
  { id: "aud_011", timestamp: daysAgo(30), userId: "usr_admin_001", userName: "Sarah Chen", action: "ROLE_CREATED", module: "admin", resourceId: "CONTENT_REVIEWER", details: "Created custom role: Content Reviewer", ipAddress: "10.0.1.1" },
  { id: "aud_012", timestamp: daysAgo(15), userId: "usr_teacher_001", userName: "Prof. Robert Smith", action: "COURSE_CREATED", module: "courses", resourceId: "crs_003", details: "Created course: Advanced React Patterns", ipAddress: "192.168.1.10" },
  { id: "aud_013", timestamp: daysAgo(8), userId: "usr_student_002", userName: "Maria Garcia", action: "COURSE_COMPLETED", module: "progress", resourceId: "crs_001", details: "Completed all lessons in Introduction to Web Development", ipAddress: "198.51.100.7" },
  { id: "aud_014", timestamp: daysAgo(7), userId: "usr_teacher_002", userName: "Dr. Emily Jones", action: "COURSE_CREATED", module: "courses", resourceId: "crs_004", details: "Created course: Machine Learning 101", ipAddress: "172.16.0.5" },
  { id: "aud_015", timestamp: daysAgo(1), userId: "usr_admin_001", userName: "Sarah Chen", action: "USER_SIGNIN", module: "auth", details: "Admin signed in", ipAddress: "10.0.1.1" },
];

/* ------------------------------------------------------------------ */
/*  Lesson Version History                                            */
/* ------------------------------------------------------------------ */

export interface StoredVersionSnapshot {
  version: number;
  savedAt: string;
  savedBy: string;
  snapshot: Record<string, any>;
}

function buildVersionHistory(): Record<string, StoredVersionSnapshot[]> {
  const history: Record<string, StoredVersionSnapshot[]> = {};
  for (const lesson of SEED_LESSONS) {
    if (lesson.version <= 1) continue;
    const versions: StoredVersionSnapshot[] = [];
    for (let v = 1; v <= lesson.version; v++) {
      versions.push({
        version: v,
        savedAt: daysAgo(60 - v * 5),
        savedBy: lesson.updatedBy,
        snapshot: { ...lesson, version: v, blocks: lesson.blocks },
      });
    }
    history[lesson.lessonId] = versions;
  }
  return history;
}

/* ------------------------------------------------------------------ */
/*  Bootstrap — call once at app start                                */
/* ------------------------------------------------------------------ */

/**
 * Bump this number whenever seed data changes to force a re-seed
 * on existing installs. Only the seed keys are overwritten — any
 * user-created data stored under different keys is preserved.
 */
const SEED_VERSION = 3;

export function ensureSeedData(): void {
  const storedVersion = getItem<number>("seed_version", 0);
  const needsReseed = storedVersion < SEED_VERSION;

  if (needsReseed) {
    setItem(STORAGE_KEYS.users, SEED_USERS);
    setItem(STORAGE_KEYS.passwords, SEED_PASSWORDS);
    setItem(STORAGE_KEYS.sessions, {} as Record<string, string>);
    setItem(STORAGE_KEYS.courses, SEED_COURSES);
    setItem(STORAGE_KEYS.lessons, SEED_LESSONS);
    setItem(STORAGE_KEYS.enrollments, SEED_ENROLLMENTS);
    setItem(STORAGE_KEYS.completions, SEED_COMPLETIONS);
    setItem(STORAGE_KEYS.roles, SEED_ROLES);
    setItem(STORAGE_KEYS.audit, SEED_AUDIT);
    setItem(STORAGE_KEYS.lessonVersions, buildVersionHistory());
    setItem("seed_version", SEED_VERSION);
    try {
      localStorage.removeItem("learninglab_user");
      localStorage.removeItem("learninglab_access_token");
      localStorage.removeItem("learninglab_refresh_token");
    } catch { /* ignore */ }
    return;
  }

  seedIfMissing(STORAGE_KEYS.users, SEED_USERS);
  seedIfMissing(STORAGE_KEYS.passwords, SEED_PASSWORDS);
  seedIfMissing(STORAGE_KEYS.sessions, {} as Record<string, string>);
  seedIfMissing(STORAGE_KEYS.courses, SEED_COURSES);
  seedIfMissing(STORAGE_KEYS.lessons, SEED_LESSONS);
  seedIfMissing(STORAGE_KEYS.enrollments, SEED_ENROLLMENTS);
  seedIfMissing(STORAGE_KEYS.completions, SEED_COMPLETIONS);
  seedIfMissing(STORAGE_KEYS.roles, SEED_ROLES);
  seedIfMissing(STORAGE_KEYS.audit, SEED_AUDIT);
  seedIfMissing(STORAGE_KEYS.lessonVersions, buildVersionHistory());
}
