// Pure zod schemas for comms forms. No React, no Supabase — validation messages are i18n keys,
// translated by `<FormField>`.
import { z } from "zod";

/** The "Send an announcement" form on the Updates page. Link is optional (no target page chosen). */
export const announcementSchema = z.object({
  title: z.string().trim().min(1, "common:form.required").max(80, "common:form.invalid"),
  body: z.string().trim().min(1, "common:form.required"),
  link: z
    .string()
    .trim()
    .transform((v) => v || null),
});
export type AnnouncementInput = z.output<typeof announcementSchema>;
