import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { BudgetStats } from "@/features/budget/ui/budget-stats";
import { ExpenseTable } from "@/features/budget/ui/expense-table";
import { OverviewStats } from "@/features/work/ui/overview-stats";
import { budgetSummary } from "@/domain/budget";
import type { Expense, ProjectSummary } from "@/lib/database.types";

// Intl separates groups and the currency with a no-break space (U+00A0) or a narrow one (U+202F).
const plain = (s: string | null) => (s ?? "").replace(/[\u00a0\u202f]/g, " ");

const project = (currency: string): ProjectSummary => ({
  id: "p1",
  name: "Maple Street Apartment",
  address: "42 Maple Street, Apt 5B",
  address_line: "42 Maple Street, Apt 5B",
  postal_code: "",
  city: "",
  country: "PL",
  currency,
  status: "active",
  start_date: "2026-03-02",
  target_date: "2026-06-10",
  budget: 84500,
  planned_target_date: "2026-06-10",
  planned_budget: 84500,
  spent: 51200,
  schedule_status: "on_schedule",
  schedule_note: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  overall_progress: 45,
  stages_done: 2,
  stages_total: 7,
  current_stage: "Walls & Insulation",
  manager_name: "Jonas Weber",
  client_display_name: null,
  plan_image_path: null,
  plan_image_opts: {},
});

const expense: Expense = {
  id: "e1",
  project_id: "p1",
  stage_id: null,
  category: "materials",
  description: "Oak planks",
  vendor: "Nordic Oak Supply",
  vendor_notes: "",
  amount: 6450,
  spent_on: "2026-04-19",
  receipt_path: null,
};

function inLocale(locale: "pl" | "en", ui: React.ReactNode) {
  return render(<I18nextProvider i18n={createI18n(locale)}>{ui}</I18nextProvider>);
}

describe("money in the project's currency", () => {
  it("BudgetStats formats budget, spent and remaining in EUR", () => {
    const p = project("EUR");
    const { container } = inLocale("en", <BudgetStats project={p} budget={budgetSummary(p)} />);
    const text = plain(container.textContent);
    expect(text).toContain("€84,500.00");
    expect(text).toContain("€51,200.00");
    expect(text).toContain("€33,300.00");
    expect(text).not.toContain("PLN");
  });

  it("BudgetStats keeps PLN for a PLN project, in Polish", () => {
    const p = project("PLN");
    const { container } = inLocale("pl", <BudgetStats project={p} budget={budgetSummary(p)} />);
    expect(plain(container.textContent)).toContain("84 500,00 zł");
  });

  it("the client overview's stats use the project's currency", () => {
    const { container } = inLocale("pl", <OverviewStats project={project("EUR")} stages={[]} />);
    const text = plain(container.textContent);
    expect(text).toContain("51 200,00 €");
    expect(text).toContain("84 500,00 €");
  });

  it("the expense table formats rows and the total in the project's currency", () => {
    inLocale("en", <ExpenseTable expenses={[expense]} stages={[]} currency="EUR" onSelect={() => {}} onOpenReceipt={() => {}} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByText((_, el) => el?.tagName === "TD" && plain(el.textContent) === "€6,450.00")).toHaveLength(2);
  });
});
