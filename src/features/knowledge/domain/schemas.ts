import { z } from "zod";

/**
 * The knowledge entry form: `tags` is a single comma-separated field in the UI, parsed into a
 * trimmed, non-empty string array on submit. zod messages are i18n keys (`common:form.required`).
 */
export const knowledgeEntrySchema = z.object({
  title: z.string().trim().min(1, "common:form.required"),
  content: z.string().trim().min(1, "common:form.required"),
  tags: z.string().transform((value) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
  is_visible: z.boolean(),
});

/** Form input shape (before parsing): `tags` is still the raw comma-separated string. */
export type KnowledgeEntryFormInput = z.input<typeof knowledgeEntrySchema>;
/** Parsed submit values: `tags` is a string array. */
export type KnowledgeEntryFormValues = z.output<typeof knowledgeEntrySchema>;
