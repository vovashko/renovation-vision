import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import type { ReactElement } from "react";
import { createI18n } from "@/i18n/instance";
import { ConfirmProvider } from "@/shared/ui/confirm-dialog";
import type { ChangeRequest, ChangeRequestEvent, VisibleContact } from "@/lib/database.types";

const h = vi.hoisted(() => ({
  acceptMutate: vi.fn(),
  rejectMutate: vi.fn(),
  contacts: [] as VisibleContact[],
}));

vi.mock("@/features/change-requests/hooks", () => ({
  useAcceptChangeRequest: () => ({ mutate: h.acceptMutate, isPending: false }),
  useRejectChangeRequest: () => ({ mutate: h.rejectMutate, isPending: false }),
}));
vi.mock("@/features/people/hooks", () => ({ useVisibleContacts: () => ({ data: h.contacts }) }));

const { ChangeRequestStatusBadge } = await import("@/features/change-requests/ui/change-request-status-badge");
const { ChangeRequestList } = await import("@/features/change-requests/ui/change-request-list");
const { ChangeRequestHistory } = await import("@/features/change-requests/ui/change-request-history");
const { ImpactPreview } = await import("@/features/change-requests/ui/impact-preview");
const { ClientActions } = await import("@/features/change-requests/ui/client-actions");
const { managerContactHref } = await import("@/features/change-requests/domain/contact");

afterEach(cleanup);

beforeEach(() => {
  h.acceptMutate.mockReset();
  h.rejectMutate.mockReset();
  h.contacts = [{ role: "poc", full_name: "Jonas", phone: "600 100 200", email: "jonas@renovision.demo", is_primary: true }];
});

const inLocale = (ui: ReactElement, locale: "en" | "pl" = "en") =>
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </I18nextProvider>,
  );

const project = { budget: 120000, target_date: "2026-03-03", currency: "PLN" };

function request(over: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: "r1",
    project_id: "p1",
    title: "Extra socket",
    description: "Two more sockets",
    cost_delta: 8800,
    days_delta: 2,
    stage_id: null,
    status: "pending",
    created_by: "u1",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    decided_by: null,
    decided_at: null,
    decision_reason: "",
    pending_since: "2026-10-01T10:00:00Z",
    ...over,
  };
}

const norm = (text: string | null) => (text ?? "").replace(/[\u00a0\u202f]/g, " ");

describe("ChangeRequestStatusBadge", () => {
  it("labels each status in both languages; an old question reads as awaiting approval", () => {
    const en = { pending: "Awaiting approval", question: "Awaiting approval", accepted: "Approved", rejected: "Rejected" } as const;
    for (const [status, label] of Object.entries(en)) {
      inLocale(<ChangeRequestStatusBadge status={status as ChangeRequest["status"]} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      cleanup();
    }
    inLocale(<ChangeRequestStatusBadge status="pending" />, "pl");
    expect(screen.getByText("Czeka na akceptację")).toBeInTheDocument();
  });
});

describe("ChangeRequestList", () => {
  const requests = [
    request({ id: "cost", title: "Cost only", cost_delta: 300, days_delta: 0, created_at: "2026-10-01T10:00:00Z" }),
    request({ id: "days", title: "Days only", cost_delta: 0, days_delta: 3, created_at: "2026-10-02T10:00:00Z", stage_id: "s1" }),
    request({ id: "both", title: "Both", cost_delta: -50, days_delta: -1, created_at: "2026-10-03T10:00:00Z" }),
    request({ id: "done", title: "Approved one", cost_delta: 10, days_delta: 0, status: "accepted", decided_at: "2026-10-04T10:00:00Z" }),
  ];
  const titles = () => screen.getAllByRole("button").map((b) => within(b).getByText(/Cost only|Days only|Both|Approved one/).textContent);

  it("Budget lists the cost changes: awaiting approval first, then the history", () => {
    const onSelect = vi.fn();
    inLocale(<ChangeRequestList requests={requests} place="budget" currency="PLN" isManager={false} onSelect={onSelect} />);
    expect(titles()).toEqual(["Both", "Cost only", "Approved one"]);
    expect(screen.getByRole("heading", { name: "Awaiting your approval" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "both" }));
  });

  it("Progress lists the day changes, with the linked stage; a request with both is in both", () => {
    inLocale(
      <ChangeRequestList requests={requests} place="progress" currency="PLN" isManager stageNames={{ s1: "Tiling" }} onSelect={vi.fn()} />,
    );
    expect(titles()).toEqual(["Both", "Days only"]);
    expect(screen.getByRole("heading", { name: "Waiting for the client" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "History" })).not.toBeInTheDocument();
    const daysRow = screen.getAllByRole("button")[1];
    expect(norm(daysRow.textContent)).toContain("+3 days");
    expect(norm(daysRow.textContent)).toContain("Stage: Tiling");
    expect(norm(daysRow.textContent)).not.toContain("PLN");
  });
});

describe("ImpactPreview", () => {
  it("shows the budget and end date before and after (Polish)", () => {
    inLocale(<ImpactPreview project={project} request={{ cost_delta: 8800, days_delta: 2 }} />, "pl");
    const text = norm(document.body.textContent);
    expect(text).toContain("Budżet: z 120 000,00 zł na 128 800,00 zł");
    expect(text).toContain("(+2 dni)");
  });

  it("explains a missing end date and warns when the budget would go below zero", () => {
    inLocale(<ImpactPreview project={{ ...project, budget: 100, target_date: null }} request={{ cost_delta: -500, days_delta: 5 }} />);
    expect(screen.getByText(/has no end date/)).toHaveTextContent("+5 days");
    expect(screen.getByRole("alert")).toHaveTextContent("below zero");
  });
});

describe("ClientActions: approve or reject, no code", () => {
  it("approving asks for confirmation spelling out the budget and end date, then approves", async () => {
    inLocale(<ClientActions projectId="p1" request={request()} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const confirmation = await screen.findByRole("alertdialog");
    expect(norm(confirmation.textContent)).toContain(
      "Budget changes from PLN 120,000.00 to PLN 128,800.00. The end date changes from Mar 03, 2026 to Mar 05, 2026. This can't be undone.",
    );
    expect(h.acceptMutate).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(h.acceptMutate).toHaveBeenCalledWith("r1"));
  });

  it("a cost-only request mentions only the budget; cancelling approves nothing", async () => {
    inLocale(<ClientActions projectId="p1" request={request({ days_delta: 0 })} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation.textContent).not.toContain("end date");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(h.acceptMutate).not.toHaveBeenCalled();
  });

  it("rejecting requires a reason", async () => {
    inLocale(<ClientActions projectId="p1" request={request()} project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(await within(dialog).findByText("A reason is required")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Too expensive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(h.rejectMutate).toHaveBeenCalledTimes(1));
    expect(h.rejectMutate.mock.calls[0][0]).toEqual({ requestId: "r1", reason: "Too expensive" });
  });

  it("links questions to the manager on WhatsApp, and offers no decision once decided", () => {
    inLocale(<ClientActions projectId="p1" request={request({ status: "accepted" })} project={project} />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Questions\? Message your manager/ })).toHaveAttribute("href", "https://wa.me/48600100200");
  });

  it("can't approve a request that would take the budget below zero", () => {
    inLocale(<ClientActions projectId="p1" request={request({ cost_delta: -200000 })} project={project} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });
});

describe("managerContactHref", () => {
  it("prefers the point of contact's WhatsApp, falls back to another contact, and is null without a number", () => {
    expect(managerContactHref(h.contacts)).toBe("https://wa.me/48600100200");
    expect(managerContactHref([{ role: "crew", full_name: "Ann", phone: "+49 151 2345678", email: null, is_primary: false }])).toBe(
      "https://wa.me/491512345678",
    );
    expect(managerContactHref([{ role: "poc", full_name: "Jonas", phone: null, email: "j@x.pl", is_primary: true }])).toBeNull();
  });
});

describe("ChangeRequestHistory", () => {
  it("lists who did what, with the reason as written, and names a deleted account", () => {
    const events: ChangeRequestEvent[] = [
      { id: 1, decision_id: "r1", kind: "submitted", actor_id: "m1", actor_role: "manager", text: "", created_at: "2026-10-01T10:00:00Z" },
      {
        id: 2,
        decision_id: "r1",
        kind: "rejected",
        actor_id: "c1",
        actor_role: "client",
        text: "Too expensive",
        created_at: "2026-10-02T10:00:00Z",
      },
      { id: 3, decision_id: "r1", kind: "reopened", actor_id: null, actor_role: null, text: "", created_at: "2026-10-03T10:00:00Z" },
    ];
    inLocale(<ChangeRequestHistory events={events} nameOf={(id) => ({ m1: "Jonas", c1: "Sarah" })[id ?? ""] ?? null} />);
    const text = norm(document.body.textContent);
    expect(text).toContain("Jonas (Manager) · Submitted the request");
    expect(text).toContain("Sarah (Client) · Rejected the request");
    expect(text).toContain("Too expensive");
    expect(text).toContain("System · Reopened the request");
  });
});
