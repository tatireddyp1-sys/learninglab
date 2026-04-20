import { z } from "zod";

export const courseTitleSchema = z
  .string()
  .min(1, "Title is required")
  .max(200, "Title must be at most 200 characters");

export const courseDescriptionSchema = z.string().max(2000, "Description must be at most 2000 characters").optional().default("");

export const courseFormSchema = z.object({
  title: courseTitleSchema,
  description: courseDescriptionSchema,
});

export const lessonTitleSchema = z.string().min(1, "Lesson title is required");

export const uploadLimits = {
  video: 500 * 1024 * 1024,
  pdf: 100 * 1024 * 1024,
  image: 25 * 1024 * 1024,
  download: 100 * 1024 * 1024,
} as const;

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const VIDEO_EXT = new Set(["mp4", "mov", "webm"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "svg"]);
/** DOCUMENT block extensions per LESSONS API contract */
const DOCUMENT_EXT = new Set([
  "pdf", "ppt", "pptx", "doc", "docx", "txt", "xls", "xlsx", "mp4", "png", "jpg", "jpeg",
]);

/** MIME for presigned PUT / getUploadUrl when `File.type` is empty (common for some PDF picks). */
export function guessContentTypeFromFileName(fileName: string): string {
  const e = ext(fileName);
  const map: Record<string, string> = {
    pdf: "application/pdf",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[e] ?? "application/octet-stream";
}

export function effectiveContentType(file: File): string {
  if (file.type && file.type.trim() !== "") return file.type;
  return guessContentTypeFromFileName(file.name);
}

export function validateUploadForBlock(
  file: File,
  blockType: "video" | "pdf" | "image" | "download" | "text" | "quiz"
): { ok: true } | { ok: false; message: string } {
  const e = ext(file.name);
  if (blockType === "video") {
    if (!VIDEO_EXT.has(e)) return { ok: false, message: "Video must be .mp4, .mov, or .webm" };
    if (file.size > uploadLimits.video) return { ok: false, message: "Video must be 500MB or less" };
  }
  if (blockType === "pdf") {
    if (!DOCUMENT_EXT.has(e)) return { ok: false, message: "This document type is not allowed for this block" };
    if (file.size > uploadLimits.pdf) return { ok: false, message: "Document must be 100MB or less" };
  }
  if (blockType === "image") {
    if (!IMAGE_EXT.has(e)) return { ok: false, message: "Image must be jpg, jpeg, png, webp, or svg" };
    if (file.size > uploadLimits.image) return { ok: false, message: "Image must be 25MB or less" };
  }
  if (blockType === "download") {
    if (!DOCUMENT_EXT.has(e) && !VIDEO_EXT.has(e) && !IMAGE_EXT.has(e)) {
      return { ok: false, message: "Allowed: documents (pdf, office…), video, or image types per LMS policy" };
    }
    if (file.size > uploadLimits.download) return { ok: false, message: "File must be 100MB or less" };
  }
  return { ok: true };
}

/** `<input accept=…>` value for lesson builder file pickers */
export const ACCEPT_VIDEO = ".mp4,.mov,.webm";
export const ACCEPT_IMAGE = ".jpg,.jpeg,.png,.webp,.svg";
export const ACCEPT_DOCUMENT =
  ".pdf,.ppt,.pptx,.doc,.docx,.txt,.xls,.xlsx,.mp4,.png,.jpg,.jpeg";
export const ACCEPT_DOWNLOAD = `${ACCEPT_VIDEO},${ACCEPT_IMAGE},${ACCEPT_DOCUMENT}`;
