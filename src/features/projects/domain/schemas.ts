import { z } from "zod";
import { scheduleStatuses, type ScheduleStatus } from "@/domain/status";

const scheduleStatusEnum = z.enum(scheduleStatuses as [ScheduleStatus, ...ScheduleStatus[]], { message: "common:form.invalid" });

/**
 * An HTML `<input type="date">` reports "" when cleared. Both forms below keep that as a plain
 * string (so the zod field type stays simple) and the call site turns "" into `null` on submit,
 * same as the repository's `start_date`/`target_date` columns expect.
 */

/** The "New project" sheet. */
export const newProjectSchema = z.object({
  name: z.string().trim().min(1, "common:form.required"),
  address: z.string().trim(),
  client_name: z.string().trim(),
  start_date: z.string(),
  target_date: z.string(),
  budget: z.coerce.number().min(0, "common:form.invalid"),
});
export type NewProjectValues = z.output<typeof newProjectSchema>;

/** The manager's "Project details" sheet. */
export const projectEditSchema = z.object({
  name: z.string().trim().min(1, "common:form.required"),
  address: z.string().trim(),
  client_name: z.string().trim(),
  start_date: z.string(),
  target_date: z.string(),
  budget: z.coerce.number().min(0, "common:form.invalid"),
  schedule_status: scheduleStatusEnum,
  schedule_note: z.string().trim(),
});
export type ProjectEditValues = z.output<typeof projectEditSchema>;
