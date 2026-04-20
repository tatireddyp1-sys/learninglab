/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LMS_API_BASE_URL?: string;
  /** When "true", auth/admin use mock even if VITE_LMS_API_BASE_URL is set */
  readonly VITE_LMS_API_MOCK_AUTH_ADMIN?: string;
  /** When "true", log each API routing decision (HTTP vs mock) to the browser console */
  readonly VITE_LMS_API_DEBUG?: string;
  /** Optional Bearer token used only for POST …/lessons (overrides session token for that module) */
  readonly VITE_LMS_LESSONS_ACCESS_TOKEN?: string;
  /** `deleteEnrollment` (default) or `removeEnrollment` — must match POST …/enrollments Lambda action */
  readonly VITE_LMS_ENROLLMENTS_DELETE_ACTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
