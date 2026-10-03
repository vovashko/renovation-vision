import { describe, it, expect } from "vitest";
import {
  DEFAULT_COUNTRY,
  formatAddress,
  isPolishPostalCode,
  projectCurrencies,
  projectStatuses,
  withCurrent,
} from "@/features/projects/domain/project-fields";
import { Constants } from "@/domain/db.types";

describe("project fields", () => {
  it("offers every lifecycle status the database has, in lifecycle order", () => {
    expect(projectStatuses).toEqual(["planning", "active", "on_hold", "completed", "archived"]);
    expect([...projectStatuses].sort()).toEqual([...Constants.public.Enums.project_status].sort());
  });

  it("offers PLN and EUR, Poland by default", () => {
    expect(projectCurrencies).toEqual(["PLN", "EUR"]);
    expect(DEFAULT_COUNTRY).toBe("PL");
  });

  it("withCurrent keeps a value set outside the offered list selectable", () => {
    expect(withCurrent(projectCurrencies, "PLN")).toEqual(["PLN", "EUR"]);
    expect(withCurrent(projectCurrencies, "USD")).toEqual(["PLN", "EUR", "USD"]);
    expect(withCurrent(projectCurrencies, undefined)).toEqual(["PLN", "EUR"]);
  });

  it("isPolishPostalCode accepts 00-000 only", () => {
    expect(isPolishPostalCode("00-238")).toBe(true);
    expect(isPolishPostalCode("00238")).toBe(false);
    expect(isPolishPostalCode("0-238")).toBe(false);
  });

  it("formatAddress mirrors the generated address column", () => {
    expect(formatAddress({ address_line: "ul. Długa 5/3", postal_code: "00-238", city: "Warszawa" })).toBe(
      "ul. Długa 5/3, 00-238 Warszawa",
    );
    expect(formatAddress({ address_line: "42 Maple Street, Apt 5B", postal_code: "", city: "" })).toBe("42 Maple Street, Apt 5B");
    expect(formatAddress({ address_line: "ul. Długa 5", postal_code: "", city: "Kraków" })).toBe("ul. Długa 5, Kraków");
    expect(formatAddress({ address_line: "", postal_code: "00-238", city: "Warszawa" })).toBe("00-238 Warszawa");
    expect(formatAddress({ address_line: "", postal_code: "", city: "" })).toBe("");
  });
});
