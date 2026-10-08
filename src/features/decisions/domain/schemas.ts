// Zod schemas for the decision forms. Pure: no React, no Supabase. Messages are i18n keys (FormField
// translates them; README → Forms). The limits mirror the table's checks.
import { z } from "zod";
import { validateFile } from "@/features/media/domain/upload";

export const MAX_PHOTOS = 10;
export const MAX_COST = 1_000_000_000;
export const MAX_DAYS = 3650;
export const CODE_LENGTH = 6;

/**
 * A signed number typed as text so a Polish decimal comma ("-1 200,50") works; empty means 0. The sign is
 * allowed on purpose: a negative cost is a saving, negative days are time gained.
 */
const signedNumber = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "0" : value.replace(/\s/g, "").replace(",", ".")))
  .pipe(z.coerce.number({ message: "common:form.invalid" }).finite("common:form.invalid"));

const cost = signedNumber
  .refine((n) => Math.abs(n) <= MAX_COST, "decisions:form.costTooLarge")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "decisions:form.costDecimals");

const days = signedNumber
  .refine((n) => Number.isInteger(n), "decisions:form.daysWhole")
  .refine((n) => Math.abs(n) <= MAX_DAYS, "decisions:form.daysTooLarge");

/** Create / edit a case (manager). Photos are handled next to the form (existing + new files). */
export const decisionSchema = z.object({
  title: z.string().trim().min(1, "common:form.required").max(160, "decisions:form.titleTooLong"),
  description: z.string().trim().max(5000, "decisions:form.descriptionTooLong"),
  cost_delta: cost,
  days_delta: days,
  files: z
    .array(z.instanceof(File))
    .refine((files) => files.every((f) => validateFile(f, "photo") !== "type"), "media:upload.fileTypeNotAllowed")
    .refine((files) => files.every((f) => validateFile(f, "photo") !== "size"), "media:upload.fileTooLarge"),
});
export type DecisionFormInput = z.input<typeof decisionSchema>;
export type DecisionFormValues = z.output<typeof decisionSchema>;

/** A free-text message: the investor's question or the manager's answer. */
export const messageSchema = z.object({ text: z.string().trim().min(1, "common:form.required").max(2000, "decisions:form.textTooLong") });
export type MessageValues = z.output<typeof messageSchema>;

/** Rejecting needs a reason. Same shape as a message, so one dialog serves all three. */
export const rejectSchema = z.object({
  text: z.string().trim().min(1, "decisions:form.reasonRequired").max(2000, "decisions:form.textTooLong"),
});

/** The emailed confirmation code: exactly 6 digits. */
export const codeSchema = z.object({ code: z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), "decisions:form.codeInvalid") });
export type CodeValues = z.output<typeof codeSchema>;
