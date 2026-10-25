import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { ClientBudgetView } from "@/features/budget/ui/client-budget-view";
import { changeRequestIssues } from "@/features/projects/domain/project-issues";

afterEach(cleanup);

const norm = (text: string | null) => (text ?? "").replace(/[\u00a0\u202f]/g, " ");
const project = { planned_budget: 120000, budget: 128800, spent: 64400, currency: "PLN" };

const renderView = (locale: "en" | "pl" = "en") =>
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <ClientBudgetView project={project}>
        <p>change requests here</p>
      </ClientBudgetView>
    </I18nextProvider>,
  );

describe("ClientBudgetView (decision 10)", () => {
  it("shows the planned, projected and spent totals with the deviation, then the change requests", () => {
    renderView();
    const text = norm(document.body.textContent);
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(text).toContain("Planned budget");
    expect(text).toContain("PLN 120,000.00");
    expect(text).toContain("Projected budget");
    expect(text).toContain("PLN 128,800.00");
    expect(text).toMatch(/\+PLN 8,800 vs the plan/);
    expect(text).toContain("PLN 64,400.00");
    expect(text).toContain("50% of the projected budget");
    expect(screen.getByText("change requests here")).toBeInTheDocument();
  });

  it("never shows expenses, receipts, vendors or internal notes", () => {
    renderView();
    const text = norm(document.body.textContent);
    for (const hidden of ["Expenses", "Receipt", "Vendor", "Internal", "Add expense"]) expect(text).not.toContain(hidden);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("is translated", () => {
    renderView("pl");
    expect(norm(document.body.textContent)).toContain("Budżet planowany");
  });
});

describe("changeRequestIssues", () => {
  it("adds 'N change requests waiting for the client' to the manager's list only when some wait", () => {
    expect(changeRequestIssues(0)).toEqual([]);
    expect(changeRequestIssues(2)).toEqual([{ kind: "change_requests_waiting", count: 2 }]);
  });
});
