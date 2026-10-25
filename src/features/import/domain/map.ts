// Column mapping: match the sheet's headers to the fields of an import by name (English and Polish),
// then read the mapped cells of every row into plain records.
import { FIELDS, type FieldDef } from "./fields";
import type { ColumnMapping, ImportKind, Sheet } from "./types";

/** Lowercase, no diacritics (including ł), punctuation and spacing collapsed to single spaces: "Data zakończenia" → "data zakonczenia". */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Best-effort mapping by header name. A column feeds at most one field; the first matching field in field order wins. */
export function autoMap(headers: string[], kind: ImportKind): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const taken = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const field of FIELDS[kind]) {
    const index = normalized.findIndex((h, i) => !taken.has(i) && field.aliases.includes(h));
    mapping[field.key] = index >= 0 ? index : null;
    if (index >= 0) taken.add(index);
  }
  return mapping;
}

/** The required fields that have no column. */
export function missingRequired(mapping: ColumnMapping, kind: ImportKind): FieldDef[] {
  return FIELDS[kind].filter((f) => f.required && mapping[f.key] == null);
}

/** A data row read through the mapping: field key → trimmed text ("" for an unmapped or empty cell), plus its sheet row number. */
export type MappedRow = { row: number; values: Record<string, string> };

/** Reads every non-empty row through the mapping. Sheet row numbers count the header as row 1. */
export function applyMapping(sheet: Sheet, mapping: ColumnMapping, kind: ImportKind): MappedRow[] {
  const out: MappedRow[] = [];
  sheet.rows.forEach((cells, i) => {
    const values: Record<string, string> = {};
    for (const field of FIELDS[kind]) {
      const index = mapping[field.key];
      values[field.key] = index == null ? "" : (cells[index] ?? "").trim();
    }
    if (Object.values(values).some((v) => v !== "")) out.push({ row: i + 2, values });
  });
  return out;
}
