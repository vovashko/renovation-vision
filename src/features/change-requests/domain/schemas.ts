// Zod schemas for the change-request forms. Pure: no React, no Supabase. Messages are i18n keys (FormField
// translates them; README → Forms). The limits mirror the table's checks.
import { z } from "zod";

export const MAX_COST = 1_000_000_000;
export const MAX_DAYS = 3650;

/** What a request changes; picks which fields the form shows (pre-chosen by the page it is opened from). */
export const CHANGE_KINDS = ["cost", "days", "both"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** The kind an existing request was made as. */
export const kindOf = (request: { cost_delta: number; days_delta: number }): ChangeKind =>
  request.cost_delta !== 0 && request.days_delta !== 0 ? "both" : request.days_delta !== 0 ? "days" : "cost";

/** The cost change as `MoneyInput` emits it: a number, null (empty) meaning 0. */
const cost = z
  .number({ message: "common:form.invalid" })
  .nullable()
  .transform((n) => n ?? 0)
  .pipe(z.number().finite("common:form.invalid"))
  .refine((n) => Math.abs(n) <= MAX_COST, "change-requests:form.costTooLarge")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "change-requests:form.costDecimals");

/** Days typed as text so a sign works ("-3"); empty means 0. Negative days are time gained. */
const days = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "0" : value.replace(/\s/g, "")))
  .pipe(z.coerce.number({ message: "common:form.invalid" }).finite("common:form.invalid"))
  .refine((n) => Number.isInteger(n), "change-requests:form.daysWhole")
  .refine((n) => Math.abs(n) <= MAX_DAYS, "change-requests:form.daysTooLarge");

/**
 * Create / edit a request (manager). The field the kind hides counts as 0; the change can't be zero: a cost
 * request needs a cost, a days request needs days, "both" needs at least one of them.
 */
export const changeRequestSchema = z
  .object({
    kind: z.enum(CHANGE_KINDS),
    title: z.string().trim().min(1, "common:form.required").max(160, "change-requests:form.titleTooLong"),
    description: z.string().trim().max(5000, "change-requests:form.descriptionTooLong"),
    cost_delta: cost,
    days_delta: days,
    /** "" = no stage. */
    stage_id: z.string(),
  })
  .transform((v) => ({
    ...v,
    cost_delta: v.kind === "days" ? 0 : v.cost_delta,
    days_delta: v.kind === "cost" ? 0 : v.days_delta,
    stage_id: v.stage_id || null,
  }))
  .superRefine((v, ctx) => {
    if (v.cost_delta === 0 && v.kind !== "days") {
      if (v.kind === "cost" || v.days_delta === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cost_delta"], message: "change-requests:form.costRequired" });
      }
    }
    if (v.days_delta === 0 && v.kind === "days") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["days_delta"], message: "change-requests:form.daysRequired" });
    }
  });
export type ChangeRequestFormInput = z.input<typeof changeRequestSchema>;
export type ChangeRequestFormValues = z.output<typeof changeRequestSchema>;

/** Rejecting needs a reason. */
export const rejectSchema = z.object({
  text: z.string().trim().min(1, "change-requests:form.reasonRequired").max(2000, "change-requests:form.textTooLong"),
});
export type RejectValues = z.output<typeof rejectSchema>;
