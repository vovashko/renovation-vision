// @vitest-environment node
// Contacts import (T46): column mapping with English and Polish headers, E.164 phones, kinds, emails, the shipped
// templates, and the RPC's 0-based row errors mapped back to sheet rows.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyMapping, autoMap, missingRequired } from "@/features/import/domain/map";
import { toE164 } from "@/features/import/domain/phone";
import { parseCsvText, parseXlsx } from "@/features/import/domain/parse";
import { issuesToSheet, parseRpcDetail, toIssuePath } from "@/features/import/domain/rpc-errors";
import { validateContacts, validateRows } from "@/features/import/domain/validate";

const template = (name: string) => readFileSync(path.resolve(__dirname, "../../../public/templates", name), "utf8");

async function validate(csv: string) {
  const sheet = await parseCsvText(csv);
  return {
    sheet,
    mapping: autoMap(sheet.headers, "contacts"),
    ...validateContacts(applyMapping(sheet, autoMap(sheet.headers, "contacts"), "contacts")),
  };
}

describe("toE164", () => {
  it.each([
    ["+48 600 100 200", "+48600100200"],
    ["+48 (600) 100-200", "+48600100200"],
    ["0048 600 100 200", "+48600100200"],
    ["600 100 200", "+48600100200"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s -> %s", (raw, expected) => expect(toE164(raw)).toBe(expected));

  it.each(["abc", "+48", "12345", "+0 600 100 200", "+48 600 100 200 300 400", "48 600 100 200", "+48 600 abc 200"])(
    "%j is not E.164",
    (raw) => expect(toE164(raw)).toBeUndefined(),
  );
});

describe("autoMap for contacts", () => {
  it("maps English headers", () => {
    const m = autoMap(["Name", "Kind", "Company", "Trade", "Phone", "WhatsApp", "Email", "Notes"], "contacts");
    expect(m).toEqual({ full_name: 0, kind: 1, company: 2, trade: 3, phone: 4, whatsapp: 5, email: 6, notes: 7 });
  });

  it("maps Polish headers, with diacritics", () => {
    const m = autoMap(["Imię i nazwisko", "Rodzaj", "Firma", "Branża", "Telefon", "WhatsApp", "E-mail", "Uwagi"], "contacts");
    expect(m).toEqual({ full_name: 0, kind: 1, company: 2, trade: 3, phone: 4, whatsapp: 5, email: 6, notes: 7 });
  });

  it("only the name is required", () => {
    const m = autoMap(["Telefon", "E-mail"], "contacts");
    expect(missingRequired(m, "contacts").map((f) => f.key)).toEqual(["full_name"]);
  });
});

describe("validateContacts", () => {
  it("accepts the English and Polish templates and normalizes the values", async () => {
    for (const name of ["contacts.csv", "contacts.pl.csv"]) {
      const { rows, issues } = await validate(template(name));
      expect(issues, name).toEqual([]);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ full_name: "Marek Nowak", kind: "crew", phone: "+48600100200", email: "marek@example.com" });
      expect(rows[1]).toMatchObject({ kind: "supplier", phone: expect.stringMatching(/^\+48\d{9}$/), whatsapp: "+48600100201" });
    }
  });

  it("reads Polish kinds and lower-cases emails", async () => {
    const { rows, issues } = await validate("Imię i nazwisko;Rodzaj;E-mail\nAnna;Klient;ANNA@Example.com\nBartek;ekipa;\nCzesław;;");
    expect(issues).toEqual([]);
    expect(rows.map((r) => [r.kind, r.email])).toEqual([
      ["client", "anna@example.com"],
      ["crew", ""],
      ["", ""],
    ]);
  });

  it("reports invalid phone, whatsapp, kind and email with sheet row numbers (header = row 1)", async () => {
    const { rows, issues } = await validate(
      "Name,Kind,Phone,WhatsApp,Email\nOk Person,crew,+48 600 100 200,,ok@example.com\n,boss,12345,abc,not-an-email",
    );
    expect(rows).toHaveLength(1);
    expect(issues).toEqual(
      expect.arrayContaining([
        { row: 3, field: "full_name", code: "required" },
        { row: 3, field: "kind", code: "invalid_kind" },
        { row: 3, field: "phone", code: "invalid_phone" },
        { row: 3, field: "whatsapp", code: "invalid_whatsapp" },
        { row: 3, field: "email", code: "invalid_email" },
      ]),
    );
    expect(issues.every((i) => i.row === 3)).toBe(true);
  });

  it("flags the same email twice in one file", async () => {
    const { issues } = await validate("Name,Email\nA,dup@example.com\nB,DUP@example.com");
    expect(issues).toEqual([{ row: 3, field: "email", code: "duplicate_in_file" }]);
  });

  it("validateRows dispatches contacts", async () => {
    const sheet = await parseCsvText("Name\nSomeone");
    const result = validateRows("contacts", applyMapping(sheet, autoMap(sheet.headers, "contacts"), "contacts"));
    expect(result.kind).toBe("contacts");
    expect(result.rows).toHaveLength(1);
  });
});

describe("the XLSX templates", () => {
  it.each(["contacts.xlsx", "contacts.pl.xlsx"])("%s reads and validates", async (name) => {
    const bytes = readFileSync(path.resolve(__dirname, "../../../public/templates", name));
    const sheet = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    const { rows, issues } = validateContacts(applyMapping(sheet, autoMap(sheet.headers, "contacts"), "contacts"));
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].phone).toBe("+48600100200");
  });
});

describe("import_contacts row errors", () => {
  it("are 0-based like import_stages and map back to sheet rows", () => {
    const rpc = parseRpcDetail(JSON.stringify([{ row: 1, field: "phone", code: "invalid_phone" }]), "contacts");
    expect(rpc).toEqual([{ index: 1, field: "phone", code: "invalid_phone" }]);
    const issues = issuesToSheet(
      rpc!.map((r) => ({ path: toIssuePath(r), message: r.code })),
      [
        { row: 2, taskRows: [] },
        { row: 5, taskRows: [] },
      ],
    );
    expect(issues).toEqual([{ row: 5, field: "phone", code: "invalid_phone" }]);
  });
});
