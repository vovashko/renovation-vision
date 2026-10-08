import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import type { ReactElement } from "react";
import { createI18n } from "@/i18n/instance";
import { ConfirmProvider } from "@/shared/ui/confirm-dialog";
import { RailItem } from "@/components/ui/rail";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TabBarRow } from "@/components/ui/tab-bar";
import { DecisionStatusBadge } from "@/features/decisions/ui/decision-status-badge";
import { ImpactPreview } from "@/features/decisions/ui/impact-preview";
import { DecisionList } from "@/features/decisions/ui/decision-list";
import { DecisionSummary } from "@/features/decisions/ui/decision-summary";
import { DecisionHistory } from "@/features/decisions/ui/decision-history";
import type { Decision, DecisionEvent } from "@/lib/database.types";

const h = vi.hoisted(() => ({
  requestMutate: vi.fn(),
  askMutate: vi.fn(),
  rejectMutate: vi.fn(),
  acceptMutate: vi.fn(),
  cooldown: { remaining: 0, start: vi.fn() },
}));

vi.mock("@/features/decisions/hooks", () => ({
  useRequestDecisionCode: () => ({ mutate: h.requestMutate, isPending: false }),
  useAskQuestion: () => ({ mutate: h.askMutate, isPending: false }),
  useRejectDecision: () => ({ mutate: h.rejectMutate, isPending: false }),
  useAcceptDecision: () => ({ mutate: h.acceptMutate, isPending: false }),
}));
vi.mock("@/features/auth/hooks", () => ({ useCooldown: () => h.cooldown }));

const { InvestorActions } = await import("@/features/decisions/ui/investor-actions");

// input-otp probes for password-manager badges with elementFromPoint, which jsdom lacks.
document.elementFromPoint ??= () => null;

afterEach(cleanup);

beforeEach(() => {
  for (const fn of [h.requestMutate, h.askMutate, h.rejectMutate, h.acceptMutate, h.cooldown.start]) fn.mockReset();
  h.cooldown.remaining = 0;
});

const inLocale = (ui: ReactElement, locale: "en" | "pl" = "en") =>
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </I18nextProvider>,
  );

const project = { budget: 84500, target_date: "2026-06-10", currency: "PLN" };

function decision(over: Partial<Decision> = {}): Decision {
  return {
    id: "d1",
    project_id: "p1",
    title: "Extra socket",
    description: "Two more sockets",
    cost_delta: 880,
    days_delta: 4,
    status: "pending",
    created_by: "u1",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    decided_by: null,
    decided_at: null,
    decision_reason: "",
    photos: [{ id: "ph1", decision_id: "d1", storage_path: "p1/decisions/a.jpg", sort_order: 1, url: "https://signed/a" }],
    ...over,
  };
}

const norm = (text: string | null) => (text ?? "").replace(/[\u00a0\u202f]/g, " ");

describe("DecisionStatusBadge", () => {
  it("uses the product's Polish labels", () => {
    const expected = {
      pending: "Oczekuje na decyzję",
      accepted: "Zaakceptowano",
      rejected: "Odrzucono",
      question: "Pytanie do wyjaśnienia",
    } as const;
    for (const [status, label] of Object.entries(expected)) {
      inLocale(<DecisionStatusBadge status={status as Decision["status"]} />, "pl");
      expect(screen.getByText(label)).toBeInTheDocument();
      cleanup();
    }
  });
});

describe("ImpactPreview", () => {
  it("shows the budget and end date before and after, with the signed deltas (Polish)", () => {
    inLocale(<ImpactPreview project={project} decision={{ cost_delta: 880, days_delta: 4 }} />, "pl");
    const text = norm(document.body.textContent);
    expect(text).toContain("Budżet: z 84 500,00 zł do 85 380,00 zł");
    expect(text).toContain("(+880,00 zł)");
    expect(text).toContain("Koniec: z 10 cze 2026 do 14 cze 2026");
    expect(text).toContain("(+4 dni)");
  });

  it("previews savings and time gained for negative deltas (English)", () => {
    inLocale(<ImpactPreview project={project} decision={{ cost_delta: -1200.5, days_delta: -3 }} />);
    const text = norm(document.body.textContent);
    expect(text).toContain("Budget: from PLN 84,500.00 to PLN 83,299.50");
    expect(text).toMatch(/\([-−]PLN 1,200\.50\)/);
    expect(text).toContain("End date: from Jun 10, 2026 to Jun 07, 2026");
    expect(text).toMatch(/\([-−]3 days\)/);
  });

  it("says so when the case changes nothing, and warns when the budget would go below zero", () => {
    inLocale(<ImpactPreview project={project} decision={{ cost_delta: 0, days_delta: 0 }} />);
    expect(screen.getByText("This case changes neither the budget nor the end date.")).toBeInTheDocument();
    cleanup();
    inLocale(<ImpactPreview project={{ ...project, budget: 100 }} decision={{ cost_delta: -500, days_delta: 0 }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("below zero");
  });

  it("explains that days can't be applied to a project without an end date", () => {
    inLocale(<ImpactPreview project={{ ...project, target_date: null }} decision={{ cost_delta: 0, days_delta: 5 }} />);
    expect(screen.getByText(/has no end date/)).toHaveTextContent("+5 days");
  });
});

describe("DecisionList and DecisionSummary", () => {
  const cases = [
    decision({ id: "a", title: "Accepted one", status: "accepted", created_at: "2026-10-05T10:00:00Z" }),
    decision({ id: "b", title: "Pending old", status: "pending", cost_delta: -300, days_delta: -2, created_at: "2026-10-01T10:00:00Z" }),
    decision({ id: "c", title: "Pending new", status: "pending", created_at: "2026-10-03T10:00:00Z" }),
    decision({ id: "d", title: "Asked", status: "question", created_at: "2026-10-04T10:00:00Z" }),
  ];

  it("lists open cases first, newest first, with signed cost and time", () => {
    const onSelect = vi.fn();
    inLocale(<DecisionList decisions={cases} currency="PLN" isManager={false} onSelect={onSelect} />, "pl");
    const rows = screen.getAllByRole("button");
    expect(rows.map((r) => within(r).getByText(/Accepted one|Pending old|Pending new|Asked/).textContent)).toEqual([
      "Pending new",
      "Pending old",
      "Asked",
      "Accepted one",
    ]);
    expect(norm(rows[1].textContent)).toContain("-300,00 zł");
    expect(norm(rows[1].textContent)).toMatch(/[-−]2 dni/);
    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
  });

  it("shows who the empty state is for", () => {
    inLocale(<DecisionList decisions={[]} currency="PLN" isManager={false} onSelect={vi.fn()} />);
    expect(screen.getByText(/has not submitted anything/)).toBeInTheDocument();
    cleanup();
    inLocale(<DecisionList decisions={[]} currency="PLN" isManager onSelect={vi.fn()} />);
    expect(screen.getByText(/Submit a case/)).toBeInTheDocument();
  });

  it("puts the pending count first; only the manager sees the questions tile", () => {
    inLocale(<DecisionSummary decisions={cases} isManager={false} />);
    const pending = screen.getByText("Awaiting decision").closest("[data-slot=stat]") as HTMLElement;
    expect(pending).toHaveTextContent("2");
    expect(screen.queryByText("Questions to answer")).not.toBeInTheDocument();
    cleanup();
    inLocale(<DecisionSummary decisions={cases} isManager />);
    expect((screen.getByText("Questions to answer").closest("[data-slot=stat]") as HTMLElement).textContent).toContain("1");
  });
});

describe("DecisionHistory", () => {
  const events: DecisionEvent[] = [
    { id: 1, decision_id: "d1", kind: "submitted", actor_id: "m1", actor_role: "manager", text: "", created_at: "2026-10-01T10:00:00Z" },
    {
      id: 2,
      decision_id: "d1",
      kind: "question",
      actor_id: "c1",
      actor_role: "client",
      text: "Is it final?",
      created_at: "2026-10-02T10:00:00Z",
    },
    {
      id: 3,
      decision_id: "d1",
      kind: "rejected",
      actor_id: null,
      actor_role: null,
      text: "Too expensive",
      created_at: "2026-10-03T10:00:00Z",
    },
  ];

  it("lists who did what with the question and reason as written, and names a deleted account", () => {
    inLocale(<DecisionHistory events={events} nameOf={(id) => ({ m1: "Jonas", c1: "Sarah" })[id ?? ""] ?? null} />);
    const text = norm(document.body.textContent);
    expect(text).toContain("Jonas (Site manager) · Submitted the case");
    expect(text).toContain("Sarah (Investor) · Asked a question");
    expect(text).toContain("Is it final?");
    expect(text).toContain("System · Rejected the case");
    expect(text).toContain("Too expensive");
  });
});

describe("InvestorActions: accepting needs 'Czy na pewno?' and then the emailed code", () => {
  it("asks for confirmation first, with the impact, and only then requests the code and opens the code dialog", async () => {
    inLocale(<InvestorActions projectId="p1" decision={decision()} project={project} />, "pl");
    fireEvent.click(screen.getByRole("button", { name: "Akceptuję" }));

    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Czy na pewno?");
    expect(norm(confirmation.textContent)).toContain("z 84 500,00 zł na 85 380,00 zł");
    expect(norm(confirmation.textContent)).toContain("z 10 cze 2026 na 14 cze 2026");
    expect(h.requestMutate).not.toHaveBeenCalled(); // nothing is sent before the investor confirms

    fireEvent.click(within(confirmation).getByRole("button", { name: "Wyślij mi kod" }));
    await waitFor(() => expect(h.requestMutate).toHaveBeenCalledTimes(1));
    expect(h.requestMutate.mock.calls[0][0]).toBe("d1");

    // The request succeeded: the code dialog opens and the resend cooldown starts.
    await act(async () => h.requestMutate.mock.calls[0][1].onSuccess());
    expect(h.cooldown.start).toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toHaveTextContent("Wpisz kod potwierdzenia");
  });

  it("cancelling the confirmation requests no code", async () => {
    inLocale(<InvestorActions projectId="p1" decision={decision()} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(await within(await screen.findByRole("alertdialog")).findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(h.requestMutate).not.toHaveBeenCalled();
  });

  it("submits the code to the accept mutation and closes on success; a wrong code shows the reason and clears the field", async () => {
    h.cooldown.remaining = 30; // a code was just sent: Accept goes straight back to entering it
    inLocale(<InvestorActions projectId="p1" decision={decision()} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    const dialog = await screen.findByRole("dialog");
    expect(h.requestMutate).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: /New code in 30 s/ })).toBeDisabled();

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "482913" } });
    await waitFor(() => expect(h.acceptMutate).toHaveBeenCalledTimes(1));
    expect(h.acceptMutate.mock.calls[0][0]).toEqual({ decisionId: "d1", code: "482913" });

    await act(async () => h.acceptMutate.mock.calls[0][1].onSuccess({ result: "invalid_code" }));
    expect(await screen.findByText(/That code is not right/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => h.acceptMutate.mock.calls[0][1].onSuccess({ result: "ok" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rejecting requires a reason", async () => {
    inLocale(<InvestorActions projectId="p1" decision={decision()} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject the case" }));
    expect(await within(dialog).findByText("A reason is required")).toBeInTheDocument();
    expect(h.rejectMutate).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Too expensive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject the case" }));
    await waitFor(() => expect(h.rejectMutate).toHaveBeenCalledTimes(1));
    expect(h.rejectMutate.mock.calls[0][0]).toEqual({ decisionId: "d1", reason: "Too expensive" });
  });

  it("a question can be asked while pending, but not while one is already open", async () => {
    inLocale(<InvestorActions projectId="p1" decision={decision()} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask a question" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Is it final?" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.askMutate).toHaveBeenCalledTimes(1));
    expect(h.askMutate.mock.calls[0][0]).toEqual({ decisionId: "d1", text: "Is it final?" });
    cleanup();

    inLocale(<InvestorActions projectId="p1" decision={decision({ status: "question" })} project={project} />);
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask a question" })).not.toBeInTheDocument();
  });

  it("offers nothing once the case is decided", () => {
    for (const status of ["accepted", "rejected"] as const) {
      const { container } = inLocale(<InvestorActions projectId="p1" decision={decision({ status })} project={project} />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it("can't accept a case that would take the budget below zero", () => {
    inLocale(<InvestorActions projectId="p1" decision={decision({ cost_delta: -90000 })} project={project} />);
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
  });
});

describe("navigation count badges", () => {
  it("shows the count on a rail item and a 'More' row, hides it at 0 and caps it at 99+", () => {
    const rail = (badge: number) => (
      <TooltipProvider>
        <RailItem icon="fact_check" label="Decisions" badge={badge} />
      </TooltipProvider>
    );
    const { rerender } = render(rail(3));
    expect(screen.getByRole("button", { name: "Decisions" })).toHaveTextContent("3");
    rerender(rail(0));
    expect(screen.getByRole("button", { name: "Decisions" })).not.toHaveTextContent("0");
    rerender(rail(120));
    expect(screen.getByRole("button", { name: "Decisions" })).toHaveTextContent("99+");
    cleanup();
    render(
      <TabBarRow icon="fact_check" badge={2}>
        Decisions
      </TabBarRow>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Decisions2");
  });
});
