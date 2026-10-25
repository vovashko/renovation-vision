export type ImportKind = "stages" | "materials";

/** A sheet as read from a file: the header row and the data rows, every cell a trimmed string. */
export type Sheet = { headers: string[]; rows: string[][] };

/** Field key → index of the sheet column that feeds it (null: not mapped). */
export type ColumnMapping = Record<string, number | null>;

/** One problem in the sheet. `row` is the sheet row as a person sees it (the header is row 1). */
export type ImportIssue = { row: number; field: string | null; code: string };

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = { stages: 500, materials: 2000 } as const;
