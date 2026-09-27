// Zod schemas for the media forms. Pure: no React, no Supabase. Messages are i18n keys — `FormField`
// translates them (README → Forms).
import { z } from "zod";

/** "Add site photos" sheet. */
export const uploadPhotosSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "media:upload.filesRequired"),
  stageId: z.string(),
  roomId: z.string(),
  caption: z.string(),
  publish: z.boolean(),
});
export type UploadPhotosValues = z.output<typeof uploadPhotosSchema>;

/** Photo edit sheet: caption, alt text, stage and room. */
export const photoEditSchema = z.object({
  caption: z.string(),
  alt: z.string(),
  stageId: z.string(),
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
      file: z.instanceof(File).nullable(),
    })
    .refine((v) => !isNew || v.file !== null, { message: "media:render.fileRequired", path: ["file"] });
}
export type RenderValues = z.output<ReturnType<typeof renderSchema>>;
