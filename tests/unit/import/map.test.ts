import { describe, expect, it } from "vitest";
import { applyMapping, autoMap, missingRequired, normalizeHeader } from "@/features/import/domain/map";

describe("normalizeHeader", () => {
  it("lowercases and strips Polish diacritics and punctuation", () => {
    expect(normalizeHeader("Data zakończenia")).toBe("data zakonczenia");
    expect(normalizeHeader("  Pokój ")).toBe("pokoj");
    expect(normalizeHeader("Unit_price (PLN)")).toBe("unit price pln");
    expect(normalizeHeader("Łazienka")).toBe("lazienka");
  });
});

describe("autoMap", () => {
  it("matches English stage headers", () => {
    const m = autoMap(["Stage", "Start date", "End date", "Client note", "Task", "Room"], "stages");
    expect(m).toEqual({ name: 0, start_date: 1, end_date: 2, client_note: 3, task: 4, room: 5 });
  });

  it("matches Polish stage headers", () => {
    const m = autoMap(["Etap", "Data rozpoczęcia", "Data zakończenia", "Notatka dla klienta", "Zadanie", "Pokój"], "stages");
    expect(m).toEqual({ name: 0, start_date: 1, end_date: 2, client_note: 3, task: 4, room: 5 });
  });

  it("matches Polish material headers, in any column order", () => {
    const m = autoMap(["Pokój", "Cena jednostkowa", "Materiał", "Ilość", "Jm"], "materials");
    expect(m).toMatchObject({ name: 2, quantity: 3, unit: 4, unit_price: 1, room: 0, status: null, supplier: null });
  });

  it("uses a column for at most one field", () => {
    const m = autoMap(["Notes"], "stages");
    expect(m.client_note).toBe(0);
    expect(Object.values(m).filter((v) => v === 0)).toHaveLength(1);
  });

  it("leaves unknown headers unmapped and reports the missing required fields", () => {
    const m = autoMap(["Foo", "Bar"], "stages");
    expect(missingRequired(m, "stages").map((f) => f.key)).toEqual(["name", "start_date", "end_date"]);
  });
});

describe("applyMapping", () => {
  it("reads mapped cells, numbers rows from the header as row 1 and skips blank rows", () => {
    const sheet = {
      headers: ["a", "b"],
      rows: [
        ["x", " 1 "],
        ["", ""],
        ["y", "2"],
      ],
    };
    const rows = applyMapping(sheet, { name: 0, quantity: 1 }, "materials");
    expect(rows.map((r) => r.row)).toEqual([2, 4]);
    expect(rows[0].values).toMatchObject({ name: "x", quantity: "1", unit: "" });
  });
});
