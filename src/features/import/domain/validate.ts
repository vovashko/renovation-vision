// Turns mapped rows into the payload of the import RPCs, validating every cell with zod. Nothing is
// sent unless every row passes; the issues carry sheet row numbers so people can fix the file.
//
// Stages file: one line per task. A line with a stage name starts a stage (dates required); a line with
// the same name as the stage above, or with no name, adds a task to it. This is the shape of
// public.import_stages (T32): [{ name, start_date, end_date, client_note?, tasks?: [{ name, room? }] }].
// Contacts: public.import_contacts (T46): [{ full_name, kind?, company?, trade?, phone?, whatsapp?, email?, notes? }], phones as E.164.
// Materials: public.import_materials (T31): [{ name, quantity?, unit?, unit_price?, status?, stage?, room?, supplier?, notes? }].
import { z } from "zod";
import type { MappedRow } from "./map";
import { normalizeHeader } from "./map";
import { parseDateCell, parseDecimal } from "./numbers";
import { toE164 } from "./phone";
import { MAX_ROWS, type ImportIssue, type ImportKind } from "./types";

export type StagePayloadRow = {
  name: string;
  start_date: string;
  end_date: string;
  client_note: string;
  tasks: { name: string; room: string }[];
};
export type MaterialPayloadRow = {
  name: string;
  quantity: number | null;
  unit: string;
  unit_price: number | null;
  status: string;
  stage: string;
  room: string;
  supplier: string;
  notes: string;
};

export type ContactPayloadRow = {
  full_name: string;
  kind: string;
  company: string;
  trade: string;
  phone: string;
  whatsapp: string;
  email: string;
  notes: string;
};

/** Where a payload row came from: its sheet row, and for a stage the sheet row of each of its tasks. */
export type RowSource = { row: number; taskRows: number[] };

export type ValidationResult<T> = { rows: T[]; sources: RowSource[]; issues: ImportIssue[] };

// --- cell schemas (the message of a failing check is the issue code, translated in the UI) ------------------

const text = (max: number) => z.string().max(max, "too_long");
const requiredText = (max: number) => z.string().min(1, "required").max(max, "too_long");

const dateCell = z
  .string()
  .min(1, "required")
  .transform((v, ctx) => {
    const date = parseDateCell(v);
    if (!date) ctx.addIssue({ code: "custom", message: "invalid_date" });
    return date ?? "";
  });

const optionalNumber = (check: (n: number) => string | undefined) =>
  z.string().transform((v, ctx): number | null => {
    if (v === "") return null;
    const n = parseDecimal(v);
    if (n === undefined) {
      ctx.addIssue({ code: "custom", message: "not_a_number" });
      return null;
    }
    const problem = check(n);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
    return n;
  });

const STATUS_ALIASES: Record<string, string> = {
  planned: "planned",
  planowany: "planned",
  zaplanowany: "planned",
  ordered: "ordered",
  zamowiony: "ordered",
  delivered: "delivered",
  dostarczony: "delivered",
  installed: "installed",
  zamontowany: "installed",
};

const statusCell = z.string().transform((v, ctx) => {
  if (v === "") return "";
  const status = STATUS_ALIASES[normalizeHeader(v)];
  if (!status) ctx.addIssue({ code: "custom", message: "invalid_status" });
  return status ?? "";
});

const KIND_ALIASES: Record<string, string> = {
  client: "client",
  klient: "client",
  crew: "crew",
  ekipa: "crew",
  pracownik: "crew",
  wykonawca: "crew",
  supplier: "supplier",
  dostawca: "supplier",
  architect: "architect",
  architekt: "architect",
  other: "other",
  inne: "other",
  inny: "other",
};

const kindCell = z.string().transform((v, ctx) => {
  if (v === "") return "";
  const kind = KIND_ALIASES[normalizeHeader(v)];
  if (!kind) ctx.addIssue({ code: "custom", message: "invalid_kind" });
  return kind ?? "";
});

/** An empty cell stays empty; anything else must be a valid number and comes out as E.164. */
const phoneCell = (code: string) =>
  z.string().transform((v, ctx) => {
    if (v === "") return "";
    const phone = toE164(v);
    if (!phone) ctx.addIssue({ code: "custom", message: code });
    return phone ?? "";
  });

const emailCell = z.string().transform((v, ctx) => {
  const email = v.toLowerCase();
  if (email === "") return "";
  if (email.length > 254 || !z.string().email().safeParse(email).success) ctx.addIssue({ code: "custom", message: "invalid_email" });
  return email;
});

const contactRowSchema = z.object({
  full_name: requiredText(160),
  kind: kindCell,
  company: text(160),
  trade: text(120),
  phone: phoneCell("invalid_phone"),
  whatsapp: phoneCell("invalid_whatsapp"),
  email: emailCell,
  notes: text(2000),
});

const stageRowSchema = z
  .object({ name: requiredText(160), start_date: dateCell, end_date: dateCell, client_note: text(2000) })
  .superRefine((row, ctx) => {
    if (row.start_date && row.end_date && row.end_date < row.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "end_before_start" });
    }
  });

const taskSchema = z.object({ task: requiredText(200), room: text(120) });

const materialRowSchema = z.object({
  name: requiredText(200),
  quantity: optionalNumber((n) => (n <= 0 ? "must_be_positive" : n >= 1e9 ? "too_large" : undefined)),
  unit: text(16),
  unit_price: optionalNumber((n) => (n < 0 ? "must_not_be_negative" : n >= 1e10 ? "too_large" : undefined)),
  status: statusCell,
  stage: text(160),
  room: text(120),
  supplier: text(160),
  notes: text(2000),
});

function toIssues(row: number, error: z.ZodError): ImportIssue[] {
  return error.issues.map((i) => ({ row, field: typeof i.path[0] === "string" ? i.path[0] : null, code: i.message }));
}

// --- stages --------------------------------------------------------------------------------------------------

export function validateStages(rows: MappedRow[]): ValidationResult<StagePayloadRow> {
  const issues: ImportIssue[] = [];
  const out: StagePayloadRow[] = [];
  const sources: RowSource[] = [];
  // After a stage line that failed, its task-only lines are skipped (they would otherwise join the stage above).
  let broken = false;

  for (const { row, values } of rows) {
    const current = out.at(-1);
    if (broken && values.name === "") continue;
    const continues = !broken && current && (values.name === "" || values.name.toLowerCase() === current.name.toLowerCase());

    if (continues) {
      // A continuation line may repeat the stage's dates, but not contradict them.
      for (const key of ["start_date", "end_date"] as const) {
        const given = values[key] === "" ? undefined : parseDateCell(values[key]);
        if (given && given !== current[key]) issues.push({ row, field: key, code: "dates_differ" });
      }
    } else {
      if (values.name === "") {
        issues.push({ row, field: "name", code: "task_without_stage" });
        continue;
      }
      const parsed = stageRowSchema.safeParse(values);
      if (!parsed.success) {
        issues.push(...toIssues(row, parsed.error));
        broken = true;
        continue;
      }
      broken = false;
      out.push({ ...parsed.data, tasks: [] });
      sources.push({ row, taskRows: [] });
    }

    const stage = out.at(-1);
    const source = sources.at(-1);
    if (!stage || !source) continue;
    if (values.task === "" && values.room === "") continue;
    const task = taskSchema.safeParse(values);
    if (!task.success) {
      issues.push(...toIssues(row, task.error));
      continue;
    }
    stage.tasks.push({ name: task.data.task, room: task.data.room });
    source.taskRows.push(row);
  }

  if (out.length > MAX_ROWS.stages) issues.push({ row: sources[MAX_ROWS.stages].row, field: null, code: "too_many_rows" });
  return { rows: out, sources, issues };
}

// --- materials -----------------------------------------------------------------------------------------------

export function validateMaterials(rows: MappedRow[]): ValidationResult<MaterialPayloadRow> {
  const issues: ImportIssue[] = [];
  const out: MaterialPayloadRow[] = [];
  const sources: RowSource[] = [];
  for (const { row, values } of rows) {
    const parsed = materialRowSchema.safeParse(values);
    if (!parsed.success) {
      issues.push(...toIssues(row, parsed.error));
      continue;
    }
    out.push(parsed.data);
    sources.push({ row, taskRows: [] });
  }
  if (out.length > MAX_ROWS.materials) issues.push({ row: sources[MAX_ROWS.materials].row, field: null, code: "too_many_rows" });
  return { rows: out, sources, issues };
}

// --- contacts ------------------------------------------------------------------------------------------------

/** Contacts file: one line per person. The same email twice is an error (the database refuses it too). */
export function validateContacts(rows: MappedRow[]): ValidationResult<ContactPayloadRow> {
  const issues: ImportIssue[] = [];
  const out: ContactPayloadRow[] = [];
  const sources: RowSource[] = [];
  const seen = new Set<string>();
  for (const { row, values } of rows) {
    const parsed = contactRowSchema.safeParse(values);
    if (!parsed.success) {
      issues.push(...toIssues(row, parsed.error));
      continue;
    }
    const { email } = parsed.data;
    if (email && seen.has(email)) {
      issues.push({ row, field: "email", code: "duplicate_in_file" });
      continue;
    }
    if (email) seen.add(email);
    out.push(parsed.data);
    sources.push({ row, taskRows: [] });
  }
  if (out.length > MAX_ROWS.contacts) issues.push({ row: sources[MAX_ROWS.contacts].row, field: null, code: "too_many_rows" });
  return { rows: out, sources, issues };
}

export type AnyValidation =
  | ({ kind: "stages" } & ValidationResult<StagePayloadRow>)
  | ({ kind: "materials" } & ValidationResult<MaterialPayloadRow>)
  | ({ kind: "contacts" } & ValidationResult<ContactPayloadRow>);

export function validateRows(kind: ImportKind, rows: MappedRow[]): AnyValidation {
  if (kind === "stages") return { kind, ...validateStages(rows) };
  if (kind === "materials") return { kind, ...validateMaterials(rows) };
  return { kind, ...validateContacts(rows) };
}
