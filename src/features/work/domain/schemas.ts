import { z } from "zod";
import type { Status } from "@/domain/status";

// Pure zod schemas for the stage, room and task forms. No React, no Supabase — see README →
// Architecture. Validation messages are i18n keys; `FormField` translates them.

const STATUS_VALUES = ["done", "progress", "pending", "blocked"] as const satisfies readonly Status[];

export const statusSchema = z.enum(STATUS_VALUES);

/** `(status = 'done') = (progress = 100)`, the same rule the database enforces (see migrations). */
function statusMatchesProgress(v: { status: Status; progress: number }) {
  return (v.status === "done") === (v.progress === 100);
}

export const stageFormSchema = z
  .object({
    name: z.string().trim().min(1, "common:form.required"),
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
