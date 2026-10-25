// Zod schemas for the documents forms. Pure: no React, no Supabase. Messages are i18n keys: `FormField`
// translates them (README → Forms).
import { z } from "zod";
import { DOCUMENT_CATEGORIES, validateDocumentFile } from "./documents";

const category = z.enum(DOCUMENT_CATEGORIES as unknown as [string, ...string[]]);

/** Upload sheet: category, the file (its name becomes the title) and an optional description. */
export const uploadDocumentSchema = z.object({
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
});
export type UploadDocumentValues = z.output<typeof uploadDocumentSchema>;

/** Edit sheet: the description is the only thing that can change. */
export const editDocumentSchema = z.object({
  description: z.string().trim().max(2000, "documents:upload.descriptionTooLong"),
});
export type EditDocumentValues = z.output<typeof editDocumentSchema>;
