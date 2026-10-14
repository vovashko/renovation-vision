// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ImportFileError, fileKind, parseCsvText, parseXlsx, readSheetFile, sheetFromMatrix } from "@/features/import/domain/parse";

const fixture = (name: string) => path.resolve(__dirname, "../../fixtures/import", name);
const text = (name: string) => readFileSync(fixture(name), "utf8");
const buffer = (name: string) => {
  const b = readFileSync(fixture(name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe("parseCsvText", () => {
  it("reads a comma file with a quoted comma", async () => {
    const sheet = await parseCsvText(text("stages-valid.csv"));
    expect(sheet.headers).toEqual(["Stage", "Start date", "End date", "Client note", "Task", "Room"]);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows[2][3]).toBe("Quiet hours, 9-17");
  });

  it("detects the semicolon delimiter and drops the BOM (Polish Excel)", async () => {
    const sheet = await parseCsvText(text("stages-pl.csv"));
    expect(sheet.headers[0]).toBe("Etap");
    expect(sheet.headers).toHaveLength(6);
    expect(sheet.rows[0]).toEqual(["Demontaż", "2026-03-02", "2026-03-13", "Zdejmujemy stare płytki i tynk", "Skuć płytki", "Łazienka"]);
  });

  it("keeps the decimal comma as text for the validator", async () => {
    const sheet = await parseCsvText(text("materials-decimal-comma.csv"));
    expect(sheet.rows[0][1]).toBe("12,5");
  });

  it("rejects an empty file", async () => {
    await expect(parseCsvText("\n\n")).rejects.toMatchObject({ code: "empty" });
  });
});

describe("parseXlsx", () => {
  it("reads the first sheet as text", async () => {
    const sheet = await parseXlsx(buffer("stages-en.xlsx"));
    expect(sheet.headers).toEqual(["Stage", "Start date", "End date", "Client note", "Task", "Room"]);
    expect(sheet.rows[0][0]).toBe("Demolition");
    expect(sheet.rows[1]).toEqual(["", "", "", "", "Strip wallpaper", "Living room"]);
  });

  it("reads Polish headers and a decimal comma", async () => {
    const sheet = await parseXlsx(buffer("materials-pl.xlsx"));
    expect(sheet.headers[0]).toBe("Materiał");
    expect(sheet.rows[0][1]).toBe("12,5");
  });
});

describe("sheetFromMatrix", () => {
  it("turns dates into ISO text, drops blank rows and trailing empty columns", () => {
    const sheet = sheetFromMatrix([["A", "B", ""], [], ["x", new Date(Date.UTC(2026, 2, 1)), null], ["", "", ""]]);
    expect(sheet).toEqual({ headers: ["A", "B"], rows: [["x", "2026-03-01"]] });
  });
});

describe("fileKind / readSheetFile", () => {
  it("decides by extension, then MIME type", () => {
    expect(fileKind({ name: "Plan.CSV" })).toBe("csv");
    expect(fileKind({ name: "plan.xlsx" })).toBe("xlsx");
    expect(fileKind({ name: "export", type: "text/csv" })).toBe("csv");
    expect(fileKind({ name: "plan.xls" })).toBeUndefined();
  });

  it("refuses unsupported and oversized files", async () => {
    await expect(readSheetFile(new File(["x"], "plan.xls"))).rejects.toBeInstanceOf(ImportFileError);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.csv");
    await expect(readSheetFile(big)).rejects.toMatchObject({ code: "too_large" });
  });

  it("reads a CSV File", async () => {
    const sheet = await readSheetFile(new File([text("stages-valid.csv")], "stages.csv"));
    expect(sheet.rows).toHaveLength(3);
  });

  it("reports a damaged XLSX as unreadable", async () => {
    await expect(readSheetFile(new File(["not a zip"], "broken.xlsx"))).rejects.toMatchObject({ code: "unreadable" });
  });
});
