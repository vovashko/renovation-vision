import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  addMember: vi.fn(async () => {}),
  addProjectContact: vi.fn(async () => {}),
}));

vi.mock("@/features/people/data/people.repo", () => ({
  peopleRepo: { addMember: h.addMember, addProjectContact: h.addProjectContact },
  PeopleRepoError: class extends Error {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { AddTeamPersonSheet } = await import("@/features/people/ui/add-team-person-sheet");

function renderSheet() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddTeamPersonSheet projectId="p1" links={[]} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.addMember.mockClear();
  h.addProjectContact.mockClear();
});

describe("AddTeamPersonSheet", () => {
  it("offers manager and crew, and no client option", () => {
    renderSheet();
    expect(screen.getByRole("radio", { name: "Manager" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Crew" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /client/i })).not.toBeInTheDocument();
  });

  it("adds a manager through addMember with the manager role", async () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jonas@renovision.demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Add manager" }));
    await waitFor(() => expect(h.addMember).toHaveBeenCalledWith("p1", "jonas@renovision.demo", "manager"));
    expect(h.addProjectContact).not.toHaveBeenCalled();
  });

  it("adds crew as a contact only, through addProjectContact", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "Crew" }));
    expect(screen.getByText(/doesn't give them access to the app/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Marek Nowak" } });
    fireEvent.click(screen.getByRole("button", { name: "Add crew member" }));
    await waitFor(() => expect(h.addProjectContact).toHaveBeenCalledWith("p1", expect.objectContaining({ kind: "crew", role: "crew" })));
    expect(h.addMember).not.toHaveBeenCalled();
  });
});
