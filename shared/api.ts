/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export type {
  Course,
  CustomRole,
  Lesson,
  LessonBlock,
  LessonBlockType,
  ApiBlockType,
  Enrollment,
  LessonCompletion,
  LmsPermission,
} from "./lms";

export {
  toApiBlockType,
  fromApiBlockType,
  mapApiBlock,
} from "./lms";
