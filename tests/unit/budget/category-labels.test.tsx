import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { EXPENSE_CATEGORIES } from "@/features/budget/domain/schemas";
import { ExpenseTable } from "@/features/budget/ui/expense-table";
import type { CostCategory, Expense } from "@/lib/database.types";

const LABELS: Record<"en" | "pl", Record<CostCategory, string>> = {
  en: {
    labour: "Labour",
    materials: "Materials",
    permits: "Permits",
    disposal: "Disposal",
    equipment: "Equipment",
    other: "Other",
  },
  pl: {
    labour: "Robocizna",
    materials: "Materiały",
    permits: "Pozwolenia",
    disposal: "Utylizacja",
    equipment: "Sprzęt",
    other: "Inne",
  },
};

const expense = (category: CostCategory, i: number): Expense => ({
  id: `e${i}`,
  project_id: "p1",
  stage_id: null,
  category,
  description: `Expense ${i}`,
  vendor: "",
  vendor_notes: "",
  amount: 100,
  spent_on: "2026-04-19",
  receipt_path: null,
});

describe.each(["en", "pl"] as const)("budget category labels (%s)", (locale) => {
  const i18n = createI18n(locale);

  it("translates every cost_category value", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(i18n.t(`budget:category.${category}`)).toBe(LABELS[locale][category]);
    }
  });

  it("shows the translated category in the expense table", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ExpenseTable expenses={EXPENSE_CATEGORIES.map(expense)} stages={[]} currency="PLN" onSelect={() => {}} onOpenReceipt={() => {}} />
      </I18nextProvider>,
    );
    for (const category of EXPENSE_CATEGORIES) {
      expect(screen.getByText(LABELS[locale][category])).toBeInTheDocument();
    }
    expect(screen.queryByText("materials")).toBeNull();
  });
});
