import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { CostBreakdownView } from "@/features/budget/ui/cost-breakdown";
import { ClientBudgetView } from "@/features/budget/ui/client-budget-view";
import type { CostBreakdown } from "@/features/budget/domain/stage-costs";

afterEach(cleanup);

const norm = (text: string | null) => (text ?? "").replace(new RegExp("[" + String.fromCharCode(0xa0, 0x202f) + "]", "g"), " ");

const clientBreakdown: CostBreakdown = {
  stages: [
    { stage_id: "a", name: "Demolition", planned: 5000, spent: 4000, committed: null },
    { stage_id: "b", name: "Flooring", planned: 20000, spent: 21000, committed: null },
  ],
  categories: [
    { category: "labour", spent: 15000 },
    { category: "materials", spent: 10000 },
  ],
};
const managerBreakdown: CostBreakdown = {
  stages: [
    { stage_id: "a", name: "Demolition", planned: 5000, spent: 4000, committed: 500 },
    { stage_id: "b", name: "Flooring", planned: 20000, spent: 15000, committed: 6000 },
  ],
  categories: clientBreakdown.categories,
};

const renderView = (breakdown: CostBreakdown, isManager: boolean, locale: "en" | "pl" = "en") =>
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <CostBreakdownView breakdown={breakdown} currency="PLN" isManager={isManager} />
    </I18nextProvider>,
  );

describe("CostBreakdownView for a client", () => {
  it("shows planned, spent and remaining per stage and spent per type of cost", () => {
    renderView(clientBreakdown, false);
    const text = norm(document.body.textContent);
    expect(text).toContain("Demolition");
    expect(text).toContain("Flooring");
    expect(text).toContain("PLN 5,000.00");
    expect(text).toContain("PLN 21,000.00");
    expect(text).toContain("Spent by type of cost");
    expect(text).toContain("Labour");
    expect(text).toContain("PLN 15,000.00");
  });

  it("has no committed column and no over-budget flag", () => {
    renderView(clientBreakdown, false);
    const text = norm(document.body.textContent);
    expect(text).not.toContain("Committed");
    expect(text).not.toContain("Over budget");
  });

  it("shows no expenses, vendors or receipts", () => {
    renderView(clientBreakdown, false);
    const text = norm(document.body.textContent);
    for (const hidden of ["Vendor", "Receipt", "Add expense", "Internal"]) expect(text).not.toContain(hidden);
  });

  it("sits under the client's Budget page without any expenses", () => {
    render(
      <I18nextProvider i18n={createI18n("en")}>
        <ClientBudgetView project={{ planned_budget: 100, budget: 100, spent: 25000, currency: "PLN" }}>
          <CostBreakdownView breakdown={clientBreakdown} currency="PLN" isManager={false} />
        </ClientBudgetView>
      </I18nextProvider>,
    );
    expect(screen.getByRole("heading", { name: "Planned and spent by stage" })).toBeInTheDocument();
    const text = norm(document.body.textContent);
    expect(text).not.toContain("Expenses");
    expect(text).not.toContain("Vendor");
  });
});

describe("CostBreakdownView for a manager", () => {
  it("adds the committed column and flags only the over-budget stage", () => {
    renderView(managerBreakdown, true);
    const text = norm(document.body.textContent);
    expect(text).toContain("Committed");
    expect(text).toContain("PLN 6,000.00");
    // Flooring: 15 000 + 6 000 > 20 000. Demolition: 4 500 <= 5 000.
    expect(screen.getAllByText("Over budget")).toHaveLength(1);
  });

  it("is translated", () => {
    renderView(managerBreakdown, true, "pl");
    expect(norm(document.body.textContent)).toContain("Plan i wydatki według etapów");
    expect(norm(document.body.textContent)).toContain("Ponad budżet");
  });
});
