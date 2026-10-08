// Zod schemas for the media forms. Pure: no React, no Supabase. Messages are i18n keys — `FormField`
// translates them (README → Forms).
import { z } from "zod";
import { validateFile } from "./upload";

/** "Add site photos" sheet. Mime type and size are checked against the `project-media` bucket's rules (domain/upload.ts). */
export const uploadPhotosSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(1, "media:upload.filesRequired")
    .refine((files) => files.every((f) => validateFile(f, "photo") !== "type"), "media:upload.fileTypeNotAllowed")
    .refine((files) => files.every((f) => validateFile(f, "photo") !== "size"), "media:upload.fileTooLarge"),
  stageId: z.string(),
  taskId: z.string(),
  roomId: z.string(),
  caption: z.string(),
  publish: z.boolean(),
});
export type UploadPhotosValues = z.output<typeof uploadPhotosSchema>;

/** Photo edit sheet: caption, alt text, stage, task and room. */
export const photoEditSchema = z.object({
  caption: z.string(),
  alt: z.string(),
  stageId: z.string(),
  taskId: z.string(),
  roomId: z.string(),
});
export type PhotoEditValues = z.output<typeof photoEditSchema>;

/**
 * Add/edit render sheet. `isNew` renders require an image; editing one can keep the existing image
 * (an empty `file`).
 */
export function renderSchema(isNew: boolean) {
  return z
    .object({
      title: z.string().trim().min(1, "common:form.required"),
      description: z.string(),
      alt: z.string(),
      roomId: z.string(),
      comparePhotoId: z.string(),
      isVisible: z.boolean(),
      file: z
        .instanceof(File)
        .nullable()
        .refine((f) => !f || validateFile(f, "render") !== "type", "media:render.fileTypeNotAllowed")
        .refine((f) => !f || validateFile(f, "render") !== "size", "media:render.fileTooLarge"),
    })
    .refine((v) => !isNew || v.file !== null, { message: "media:render.fileRequired", path: ["file"] });
}
export type RenderValues = z.output<ReturnType<typeof renderSchema>>;

/**
 * The task id to store for a photo: only a task that belongs to the chosen step counts, so changing the step
 * after picking a task never leaves the photo pointing at another step's task.
 */
export function resolveTaskId(stages: { id: string; tasks: { id: string }[] }[], stageId: string, taskId: string): string | null {
  if (!stageId || !taskId) return null;
  return stages.find((s) => s.id === stageId)?.tasks.some((t) => t.id === taskId) ? taskId : null;
}
