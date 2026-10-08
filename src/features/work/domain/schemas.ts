import { z } from "zod";
import { materialStatuses, type MaterialStatus } from "@/domain/materials";
import type { TaskState } from "@/domain/progress";
import type { Status } from "@/domain/status";
import type { ProgressMode } from "@/lib/database.types";

// Pure zod schemas for the stage, room and task forms. No React, no Supabase — see README →
// Architecture. Validation messages are i18n keys; `FormField` translates them.

const STATUS_VALUES = ["done", "progress", "pending", "blocked"] as const satisfies readonly Status[];

export const statusSchema = z.enum(STATUS_VALUES);

const PROGRESS_MODES = ["tasks", "manual"] as const satisfies readonly ProgressMode[];

/** `tasks`: progress and status follow the checklist (the database recomputes them); `manual`: set by hand. */
export const progressModeSchema = z.enum(PROGRESS_MODES);

/** `(status = 'done') = (progress = 100)`, the same rule the database enforces (see migrations). */
function statusMatchesProgress(v: { status: Status; progress: number }) {
  return (v.status === "done") === (v.progress === 100);
}

export const stageFormSchema = z
  .object({
    name: z.string().trim().min(1, "common:form.required"),
    progress_mode: progressModeSchema,
    // In tasks mode these hold the computed values (`deriveFromTasks`); only "blocked" is chosen by hand.
    status: statusSchema,
    progress: z.number().min(0).max(100),
    start_date: z.string().min(1, "common:form.required"),
    end_date: z.string().min(1, "common:form.required"),
    client_note: z.string(),
    is_visible: z.boolean(),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "work:stageForm.endBeforeStart", path: ["end_date"] })
  .refine(statusMatchesProgress, { message: "work:stageForm.statusProgressMismatch", path: ["progress"] });

export type StageFormValues = z.infer<typeof stageFormSchema>;

export const roomFormSchema = z
  .object({
    name: z.string().trim().min(1, "common:form.required"),
    status: statusSchema,
    progress: z.number().min(0).max(100),
    client_note: z.string(),
    is_visible: z.boolean(),
    x: z.number().min(0).max(600),
    y: z.number().min(0).max(420),
    w: z.number().min(10).max(600),
    h: z.number().min(10).max(420),
  })
  .refine(statusMatchesProgress, { message: "work:roomForm.statusProgressMismatch", path: ["progress"] });

export type RoomFormValues = z.infer<typeof roomFormSchema>;

export const taskAddFormSchema = z.object({
  name: z.string().trim().min(1, "common:form.required"),
  // "" means "no room" — NativeSelect has no null option value.
  room_id: z.string(),
});

export type TaskAddFormValues = z.infer<typeof taskAddFormSchema>;

// --- Room view (issue #56): the room's works, materials and investor warnings ---------------------

const TASK_STATES = ["todo", "in_progress", "done"] as const satisfies readonly TaskState[];

export const taskStateSchema = z.enum(TASK_STATES);

export const roomTaskFormSchema = z.object({
  name: z.string().trim().min(1, "common:form.required"),
  // "" means "no stage" (a work that belongs to the room only).
  stage_id: z.string(),
});

export type RoomTaskFormValues = z.infer<typeof roomTaskFormSchema>;

export const materialStatusSchema = z.enum(materialStatuses as [MaterialStatus, ...MaterialStatus[]]);

/** Dates are `YYYY-MM-DD` from a date input; "" means "not set". */
const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "common:form.invalid");

export const materialFormSchema = z.object({
  name: z.string().trim().min(1, "common:form.required"),
  quantity: z.number({ message: "common:form.invalid" }).positive("common:form.invalid").max(999_999_999, "common:form.invalid"),
  unit: z.string().trim().min(1, "common:form.required").max(16, "common:form.invalid"),
  status: materialStatusSchema,
  order_by_date: optionalDate,
  delivery_date: optionalDate,
});

export type MaterialFormValues = z.infer<typeof materialFormSchema>;

export const warningFormSchema = z.object({
  text: z.string().trim().min(1, "common:form.required").max(2000, "common:form.invalid"),
  // The materials this risk is about; none means the warning stays until the manager removes it.
  material_ids: z.array(z.string()),
});

export type WarningFormValues = z.infer<typeof warningFormSchema>;
