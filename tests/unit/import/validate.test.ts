// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyMapping, autoMap } from "@/features/import/domain/map";
import { parseDateCell, parseDecimal } from "@/features/import/domain/numbers";
import { parseCsvText } from "@/features/import/domain/parse";
import { fromIssuePath, issuesToSheet, parseRpcDetail, toIssuePath } from "@/features/import/domain/rpc-errors";
import type { ImportKind } from "@/features/import/domain/types";
import { validateMaterials, validateRows, validateStages, type AnyValidation } from "@/features/import/domain/validate";

const read = (name: string) => readFileSync(path.resolve(__dirname, "../../fixtures/import", name), "utf8");

async function validateFixture(name: string, kind: "stages"): Promise<Extract<AnyValidation, { kind: "stages" }>>;
async function validateFixture(name: string, kind: "materials"): Promise<Extract<AnyValidation, { kind: "materials" }>>;
async function validateFixture(name: string, kind: ImportKind): Promise<AnyValidation> {
  const sheet = await parseCsvText(read(name));
  return validateRows(kind, applyMapping(sheet, autoMap(sheet.headers, kind), kind));
}

describe("parseDecimal", () => {
  it.each([
    ["12,50", 12.5],
    ["12.50", 12.5],
    ["12", 12],
    ["1 234,50", 1234.5],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["1,234,567", 1234567],
    ["-3", -3],
    ["0,5", 0.5],
  ])("%s → %s", (raw, expected) => expect(parseDecimal(raw)).toBe(expected));

  it.each(["", "abc", "12,5 zł", "1,2,3x", ",", "."])("%j is not a number", (raw) => expect(parseDecimal(raw)).toBeUndefined());
});

describe("parseDateCell", () => {
  it("accepts ISO and day-first dates", () => {
    expect(parseDateCell("2026-03-01")).toBe("2026-03-01");
    expect(parseDateCell("1.3.2026")).toBe("2026-03-01");
    expect(parseDateCell("01/03/2026")).toBe("2026-03-01");
  });
  it("rejects impossible and unknown formats", () => {
    expect(parseDateCell("2026-02-30")).toBeUndefined();
    expect(parseDateCell("March 1")).toBeUndefined();
    expect(parseDateCell("")).toBeUndefined();
  });
});

describe("validateStages", () => {
  it("groups task lines under their stage and records the sheet rows", async () => {
    const result = await validateFixture("stages-valid.csv", "stages");
    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        name: "Demolition",
        start_date: "2026-03-02",
        end_date: "2026-03-13",
        client_note: "",
        tasks: [
          { name: "Remove tiles", room: "Bathroom" },
          { name: "Strip wallpaper", room: "Living room" },
        ],
      },
      {
        name: "Electrics",
        start_date: "2026-03-16",
        end_date: "2026-03-27",
        client_note: "Quiet hours, 9-17",
        tasks: [{ name: "Lay cables", room: "" }],
      },
    ]);
    expect(result.sources).toEqual([
      { row: 2, taskRows: [2, 3] },
      { row: 4, taskRows: [4] },
    ]);
  });

  it("reads Polish headers", async () => {
    const result = await validateFixture("stages-pl.csv", "stages");
    expect(result.issues).toEqual([]);
    expect(result.rows.map((r) => r.name)).toEqual(["Demontaż", "Elektryka"]);
    expect(result.rows[0].tasks).toHaveLength(2);
  });

  it("reports malformed rows by sheet row and does not attach tasks to a broken stage", async () => {
    const result = await validateFixture("stages-malformed.csv", "stages");
    expect(result.issues).toEqual([
      { row: 3, field: "start_date", code: "invalid_date" },
      { row: 4, field: "end_date", code: "end_before_start" },
    ]);
    // The orphan task line (row 5) follows a broken stage, so it is skipped rather than joining "Demolition".
    expect(result.rows.map((r) => r.name)).toEqual(["Demolition"]);
    expect(result.rows[0].tasks).toHaveLength(1);
  });

  it("flags a task line before any stage and contradicting dates", () => {
    const base = { start_date: "", end_date: "", client_note: "", room: "" };
    const first = validateStages([{ row: 2, values: { ...base, name: "", task: "Orphan" } }]);
    expect(first.issues).toEqual([{ row: 2, field: "name", code: "task_without_stage" }]);

    const second = validateStages([
      { row: 2, values: { ...base, name: "A", start_date: "2026-01-01", end_date: "2026-01-05", task: "t1" } },
      { row: 3, values: { ...base, name: "A", start_date: "2026-02-01", task: "t2" } },
    ]);
    expect(second.issues).toEqual([{ row: 3, field: "start_date", code: "dates_differ" }]);
  });

  it("requires the stage fields", () => {
    const result = validateStages([{ row: 2, values: { name: "A", start_date: "", end_date: "", client_note: "", task: "", room: "" } }]);
    expect(result.issues).toEqual([
      { row: 2, field: "start_date", code: "required" },
      { row: 2, field: "end_date", code: "required" },
    ]);
  });
});

describe("validateMaterials", () => {
  it("parses decimal commas and Polish status names", async () => {
    const sheet = await parseCsvText(read("materials-decimal-comma.csv"));
    const rows = applyMapping(sheet, autoMap(sheet.headers, "materials"), "materials").slice(0, 2);
    const result = validateMaterials(rows);
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      name: "Płytki 60x60",
      quantity: 12.5,
      unit: "m2",
      unit_price: 89.9,
      status: "planned",
      room: "Łazienka",
    });
    expect(result.rows[1]).toMatchObject({ unit_price: 12.5, status: "ordered" });
  });

  it("reports a malformed row with every problem in it", async () => {
    const result = await validateFixture("materials-decimal-comma.csv", "materials");
    expect(result.rows).toHaveLength(2);
    expect(result.issues).toEqual([
      { row: 4, field: "quantity", code: "not_a_number" },
      { row: 4, field: "unit_price", code: "must_not_be_negative" },
      { row: 4, field: "status", code: "invalid_status" },
    ]);
  });

  it("defaults optional cells to empty / null for the RPC to default", () => {
    const result = validateMaterials([
      {
        row: 2,
        values: { name: "Paint", quantity: "", unit: "", unit_price: "", status: "", stage: "", room: "", supplier: "", notes: "" },
      },
    ]);
    expect(result.rows[0]).toMatchObject({ quantity: null, unit_price: null, status: "" });
  });

  it("refuses a quantity of zero and a name that is missing", () => {
    const result = validateMaterials([
      { row: 2, values: { name: "", quantity: "0", unit: "", unit_price: "", status: "", stage: "", room: "", supplier: "", notes: "" } },
    ]);
    expect(result.issues).toEqual([
      { row: 2, field: "name", code: "required" },
      { row: 2, field: "quantity", code: "must_be_positive" },
    ]);
  });
});

describe("RPC error mapping", () => {
  it("parses the 0-based stage details and the 1-based material details to 0-based indexes", () => {
    expect(parseRpcDetail('[{"row":1,"field":"tasks[0].room","code":"room_not_found"}]', "stages")).toEqual([
      { index: 1, field: "tasks[0].room", code: "room_not_found" },
    ]);
    expect(parseRpcDetail('[{"row":3,"field":"room","message":"not_found"}]', "materials")).toEqual([
      { index: 2, field: "room", code: "not_found" },
    ]);
    expect(parseRpcDetail("not json", "stages")).toBeUndefined();
    expect(parseRpcDetail(null, "stages")).toBeUndefined();
  });

  it("round-trips issue paths", () => {
    expect(fromIssuePath(toIssuePath({ index: 2, field: "tasks[1].room", code: "x" }))).toEqual({ index: 2, field: "tasks[1].room" });
    expect(fromIssuePath(toIssuePath({ index: 0, field: null, code: "x" }))).toEqual({ index: 0, field: null });
    expect(fromIssuePath("nope")).toBeUndefined();
  });

  it("maps issues back to sheet rows, using the task's own row for task fields", () => {
    const sources = [
      { row: 2, taskRows: [2, 3] },
      { row: 4, taskRows: [4] },
    ];
    expect(
      issuesToSheet(
        [
          { path: "0.tasks[1].room", message: "room_not_found" },
          { path: "1.end_date", message: "end_before_start" },
          { path: "1", message: "not_an_object" },
          { path: "9.name", message: "required" },
        ],
        sources,
      ),
    ).toEqual([
      { row: 3, field: "room", code: "room_not_found" },
      { row: 4, field: "end_date", code: "end_before_start" },
      { row: 4, field: null, code: "not_an_object" },
      { row: 1, field: null, code: "required" },
    ]);
  });
});
