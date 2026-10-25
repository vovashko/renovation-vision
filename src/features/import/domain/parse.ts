// Reads a picked file into a Sheet. CSV goes through papaparse; XLSX through read-excel-file. Both are
// imported on demand, so the parsers are only fetched when someone actually picks a file of that kind.
// Cells are never evaluated: formulas arrive as the values the file stored, and every cell becomes text.
import { MAX_FILE_BYTES, type Sheet } from "./types";

export class ImportFileError extends Error {
  constructor(readonly code: "too_large" | "unsupported" | "empty" | "unreadable") {
    super(code);
    this.name = "ImportFileError";
  }
}

export type FileKind = "csv" | "xlsx";

/** Decides by extension first (browsers report odd MIME types for CSV), then by MIME type. */
export function fileKind(file: { name: string; type?: string }): FileKind | undefined {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  if (file.type === "text/csv") return "csv";
  if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  return undefined;
}

/** "2026-03-01" for a date cell; the cell as text otherwise. Dates from XLSX are UTC midnights, so read them in UTC. */
function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** A matrix of cells (first row = headers) → a Sheet without blank trailing rows or columns. */
export function sheetFromMatrix(matrix: unknown[][]): Sheet {
  const text = matrix.map((row) => row.map(cellText));
  const nonEmpty = text.filter((row) => row.some((c) => c !== ""));
  if (nonEmpty.length === 0) throw new ImportFileError("empty");
  const [headers, ...rows] = nonEmpty;
  let width = headers.length;
  while (width > 0 && headers[width - 1] === "") width--;
  if (width === 0) throw new ImportFileError("empty");
  return { headers: headers.slice(0, width), rows: rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")) };
}

const stripBom = (value: string) => (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value);

/** Parses CSV text. The delimiter (comma, semicolon, tab) is detected, since Polish Excel exports semicolons. */
export async function parseCsvText(text: string): Promise<Sheet> {
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<string[]>(stripBom(text), { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t"] });
  return sheetFromMatrix(result.data);
}

/** Parses the first sheet of an XLSX file. */
export async function parseXlsx(data: Blob | ArrayBuffer): Promise<Sheet> {
  const { readSheet } = await import("read-excel-file/universal");
  return sheetFromMatrix(await readSheet(data));
}

/** Reads a picked file (CSV or XLSX, up to 5 MB). Throws ImportFileError. */
export async function readSheetFile(file: File): Promise<Sheet> {
  if (file.size > MAX_FILE_BYTES) throw new ImportFileError("too_large");
  const kind = fileKind(file);
  if (!kind) throw new ImportFileError("unsupported");
  try {
    return kind === "csv" ? await parseCsvText(await file.text()) : await parseXlsx(file);
  } catch (e) {
    if (e instanceof ImportFileError) throw e;
    throw new ImportFileError("unreadable");
  }
}
