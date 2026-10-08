// Zod schemas for the documents forms. Pure: no React, no Supabase. Messages are i18n keys: `FormField`
// translates them (README → Forms).
import { z } from "zod";
import { DOCUMENT_CATEGORIES, isImageMime, isVersionedCategory, validateDocumentFile } from "./documents";

const category = z.enum(DOCUMENT_CATEGORIES as unknown as [string, ...string[]]);

/**
 * Upload sheet. `versionOf` is the `version_group` of the document this file is a new version of ("" for a new
 * document); it only counts for contract and estimate.
 */
export const uploadDocumentSchema = z
  .object({
    title: z.string().trim().min(1, "common:form.required").max(200, "documents:upload.titleTooLong"),
    category,
    description: z.string().trim().max(2000, "documents:upload.descriptionTooLong"),
    file: z
      .instanceof(File, { message: "documents:upload.fileRequired" })
      .nullable()
      .refine((f) => f !== null, "documents:upload.fileRequired")
      .refine((f) => !f || validateDocumentFile(f) !== "type", "documents:upload.fileTypeNotAllowed")
      .refine((f) => !f || validateDocumentFile(f) !== "extension", "documents:upload.fileExtensionMismatch")
      .refine((f) => !f || validateDocumentFile(f) !== "empty", "documents:upload.fileEmpty")
      .refine((f) => !f || validateDocumentFile(f) !== "size", "documents:upload.fileTooLarge"),
    roomId: z.string(),
    taskId: z.string(),
    versionOf: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.category === "installation_photos") {
      if (!v.roomId) ctx.addIssue({ code: "custom", path: ["roomId"], message: "documents:upload.roomRequired" });
      if (v.file && !isImageMime(v.file.type))
        ctx.addIssue({ code: "custom", path: ["file"], message: "documents:upload.photoMustBeImage" });
    }
  });
export type UploadDocumentValues = z.output<typeof uploadDocumentSchema>;

/** Whether a "new version of" choice applies to this category. */
export function versionApplies(categoryValue: string): boolean {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(categoryValue) && isVersionedCategory(categoryValue as never);
}

/** Edit sheet: title, description and, for installation photos, room (required) and work. */
export function editDocumentSchema(isPhoto: boolean) {
  return z
    .object({
      title: z.string().trim().min(1, "common:form.required").max(200, "documents:upload.titleTooLong"),
      description: z.string().trim().max(2000, "documents:upload.descriptionTooLong"),
      roomId: z.string(),
      taskId: z.string(),
    })
    .superRefine((v, ctx) => {
      if (isPhoto && !v.roomId) ctx.addIssue({ code: "custom", path: ["roomId"], message: "documents:upload.roomRequired" });
    });
}
export type EditDocumentValues = z.output<ReturnType<typeof editDocumentSchema>>;
