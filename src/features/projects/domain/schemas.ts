import { z } from "zod";
import { scheduleStatuses, type ScheduleStatus } from "@/domain/status";
import { isPolishPostalCode, projectStatuses, type ProjectStatus } from "./project-fields";

const scheduleStatusEnum = z.enum(scheduleStatuses as [ScheduleStatus, ...ScheduleStatus[]], { message: "common:form.invalid" });
const projectStatusEnum = z.enum(projectStatuses as [ProjectStatus, ...ProjectStatus[]], { message: "common:form.invalid" });

/**
 * An HTML `<input type="date">` reports "" when cleared. Both forms below keep that as a plain
 * string (so the zod field type stays simple) and the call site turns "" into `null` on submit,
 * same as the repository's `start_date`/`target_date` columns expect.
 */

/** The structured address and money fields both forms share (the database checks the same formats). */
const projectFields = {
  name: z.string().trim().min(1, "common:form.required"),
  address_line: z.string().trim(),
  postal_code: z.string().trim(),
  city: z.string().trim(),
  country: z.string().regex(/^[A-Z]{2}$/, "common:form.invalid"),
  currency: z.string().regex(/^[A-Z]{3}$/, "common:form.invalid"),
  status: projectStatusEnum,
  start_date: z.string(),
  target_date: z.string(),
  budget: z.coerce.number().min(0, "common:form.invalid"),
};

/** A Polish address takes a "00-000" postal code; other countries' formats aren't checked. */
function checkPostalCode(values: { country: string; postal_code: string }, ctx: z.RefinementCtx) {
  if (values.country === "PL" && values.postal_code && !isPolishPostalCode(values.postal_code)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["postal_code"], message: "projects:form.postalCodePl" });
  }
}

/** The "New project" sheet. `client_name`, when given, becomes the project's primary client contact. */
export const newProjectSchema = z.object({ ...projectFields, client_name: z.string().trim() }).superRefine(checkPostalCode);
export type NewProjectValues = z.output<typeof newProjectSchema>;

/** The manager's "Project details" sheet. The client's name and contact details live on the client card. */
export const projectEditSchema = z
  .object({ ...projectFields, schedule_status: scheduleStatusEnum, schedule_note: z.string().trim() })
  .superRefine(checkPostalCode);
export type ProjectEditValues = z.output<typeof projectEditSchema>;
