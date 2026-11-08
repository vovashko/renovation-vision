import { z } from "zod";
import type { ProgressEntry } from "@/lib/database.types";
import { validateFile } from "@/features/media/domain/upload";

// Pure rules for the site diary (T43): the entry form's schema, the hours text, and how entries are
// grouped, filtered and trimmed for the client. No React, no Supabase.

/** Hours as typed: "2", "1.5" or "1,5" (decimal comma); at most two decimals, below 1000. Null when not a valid amount. */
export function parseHours(text: string): number | null {
  const s = text.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

/** Local `YYYY-MM-DD` for a date (the date input's default is today). */
export function isoDay(d: Date = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export const diaryFormSchema = z.object({
  note: z.string().trim().min(1, "common:form.required").max(4000, "common:form.invalid"),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "common:form.required"),
  // "" means "no stage" / "no room".
  stageId: z.string(),
  roomId: z.string(),
  /** Typed text; the parsed number (or null when empty) is what the submit handler receives. */
  hours: z
    .string()
    .trim()
    .refine((v) => v === "" || parseHours(v) !== null, "common:form.invalid")
    .transform((v) => (v === "" ? null : parseHours(v))),
  files: z
    .array(z.instanceof(File))
    .refine((files) => files.every((f) => validateFile(f, "photo") !== "type"), "media:upload.fileTypeNotAllowed")
    .refine((files) => files.every((f) => validateFile(f, "photo") !== "size"), "media:upload.fileTooLarge"),
  materialIds: z.array(z.string()),
  is_visible: z.boolean(),
});
export type DiaryFormValues = z.output<typeof diaryFormSchema>;

export type DiaryDay = { date: string; entries: ProgressEntry[] };

/** Newest first: by entry date, then by when it was written. */
function newestFirst(a: ProgressEntry, b: ProgressEntry): number {
  return b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at);
}

/** Entries grouped by day, newest day first and newest entry first within a day. */
export function groupByDay(entries: ProgressEntry[]): DiaryDay[] {
  const days = new Map<string, ProgressEntry[]>();
  for (const entry of [...entries].sort(newestFirst)) {
    const list = days.get(entry.entry_date);
    if (list) list.push(entry);
    else days.set(entry.entry_date, [entry]);
  }
  return [...days].map(([date, list]) => ({ date, entries: list }));
}

/** The entries of one stage; an empty stage id means all of them. */
export function filterByStage(entries: ProgressEntry[], stageId: string): ProgressEntry[] {
  return stageId ? entries.filter((e) => e.stage_id === stageId) : entries;
}

/** What a client may see: visible entries only (the database enforces the same rule). */
export function visibleToClient(entries: ProgressEntry[]): ProgressEntry[] {
  return entries.filter((e) => e.is_visible);
}

/** The latest few visible entries, for the client Overview's "From the site" card. */
export function latestVisible(entries: ProgressEntry[], count: number): ProgressEntry[] {
  return visibleToClient(entries).sort(newestFirst).slice(0, count);
}
