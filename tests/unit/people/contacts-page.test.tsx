import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Contact } from "@/lib/database.types";

const contact = (over: Partial<Contact> & { id: string; full_name: string }): Contact => ({
  kind: "other",
  company: null,
  trade: null,
  phone: null,
  whatsapp: null,
  email: null,
  notes: null,
  user_id: null,
  ...over,
});

const h = vi.hoisted(() => ({
  contacts: [] as Contact[],
  links: {} as Record<string, unknown[]>,
  assignContact: vi.fn(async (..._args: unknown[]) => {}),
  deleteContact: vi.fn(async (..._args: unknown[]) => {}),
}));

vi.mock("@/features/people/data/people.repo", () => ({
  peopleRepo: {
    listContacts: async () => h.contacts,
    listContactLinks: async (id: string) => h.links[id] ?? [],
    assignContact: h.assignContact,
    deleteContact: h.deleteContact,
    createContact: vi.fn(),
    updateContact: vi.fn(),
    unlinkProjectContact: vi.fn(),
    setLinkVisible: vi.fn(),
  },
  PeopleRepoError: class extends Error {},
}));
vi.mock("@/features/projects/hooks", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Maple Street" },
      { id: "p2", name: "Oak Lane" },
    ],
  }),
}));
// The import wizard pulls in the server function; the page only needs its button.
vi.mock("@/server/functions/import", () => ({ importRows: vi.fn(), importContacts: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix switches measure their box; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const { ContactsPage } = await import("@/features/people/ui/contacts-page");
const { ConfirmProvider } = await import("@/shared/ui/confirm-dialog");

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <ContactsPage />
      </ConfirmProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.contacts = [
    contact({ id: "c1", full_name: "Marek Nowak", kind: "crew", trade: "Site lead", phone: "+48 600 100 200", email: "marek@example.com" }),
    contact({ id: "c2", full_name: "Ana Petrović", kind: "crew", trade: "Electrician" }),
    contact({ id: "c3", full_name: "Płytki24", kind: "supplier", company: "Hurtownia Płytek", trade: "Tiles", whatsapp: "+48600100201" }),
    contact({ id: "c4", full_name: "Sarah Bennett", kind: "client", email: "sarah@renovision.demo" }),
  ];
  h.links = {};
  h.assignContact.mockClear();
  h.deleteContact.mockClear();
});

const rowNames = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");

describe("ContactsPage: list, search and filters", () => {
  it("lists every contact with its count", async () => {
    renderPage();
    expect(await screen.findByText("Marek Nowak")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("4 of 4 contacts");
  });

  it("filters as you type in the search box", async () => {
    renderPage();
    await screen.findByText("Marek Nowak");
    fireEvent.change(screen.getByLabelText("Search contacts"), { target: { value: "plytki" } });
    expect(rowNames()).toHaveLength(1);
    expect(screen.getByText("Płytki24")).toBeInTheDocument();
    expect(screen.queryByText("Marek Nowak")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4 contacts");
  });

  it("filters by kind and by trade, and offers every trade in the book", async () => {
    renderPage();
    await screen.findByText("Marek Nowak");
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "crew" } });
    expect(screen.queryByText("Sarah Bennett")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Petrović")).toBeInTheDocument();

    const trade = screen.getByLabelText("Trade");
    expect(
      within(trade)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["All trades", "Electrician", "Site lead", "Tiles"]);
    fireEvent.change(trade, { target: { value: "Electrician" } });
    expect(screen.getByText("Ana Petrović")).toBeInTheDocument();
    expect(screen.queryByText("Marek Nowak")).not.toBeInTheDocument();
  });

  it("says so and offers to clear when nothing matches", async () => {
    renderPage();
    await screen.findByText("Marek Nowak");
    fireEvent.change(screen.getByLabelText("Search contacts"), { target: { value: "zzz" } });
    expect(screen.getByText("No contacts match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Marek Nowak")).toBeInTheDocument();
  });

  it("shows WhatsApp, call and email buttons only for the details a contact has", async () => {
    renderPage();
    await screen.findByText("Marek Nowak");
    // Marek: phone + email -> WhatsApp (falls back to the phone), call, email.
    expect(screen.getByRole("link", { name: "Call Marek Nowak" })).toHaveAttribute("href", "tel:+48600100200");
    expect(screen.getByRole("link", { name: "Message Marek Nowak on WhatsApp" })).toHaveAttribute("href", "https://wa.me/48600100200");
    expect(screen.getByRole("link", { name: "Email Marek Nowak" })).toHaveAttribute("href", "mailto:marek@example.com");
    // Płytki24: a WhatsApp number only.
    expect(screen.getByRole("link", { name: "Message Płytki24 on WhatsApp" })).toHaveAttribute("href", "https://wa.me/48600100201");
    expect(screen.queryByRole("link", { name: "Call Płytki24" })).not.toBeInTheDocument();
    // Ana: nothing to call.
    expect(screen.queryByRole("link", { name: /Ana Petrović/ })).not.toBeInTheDocument();
  });
});

describe("ContactsPage: delete guard", () => {
  it("refuses to delete a contact that is on a project and names the project", async () => {
    h.links = {
      c1: [
        {
          id: "l1",
          project_id: "p1",
          role: "crew",
          is_primary: false,
          visible_to_client: false,
          project: { id: "p1", name: "Maple Street" },
        },
      ],
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Marek Nowak" }));
    expect(await screen.findByText(/Maple Street: remove this contact from these projects/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete contact" })).toBeDisabled();
    expect(h.deleteContact).not.toHaveBeenCalled();
  });

  it("deletes a contact that is on no project, after a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Ana Petrović" }));
    const button = await screen.findByRole("button", { name: "Delete contact" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete contact" }));
    await waitFor(() => expect(h.deleteContact).toHaveBeenCalledWith("c2"));
  });
});

describe("ContactsPage: assigning to a project", () => {
  it("never offers the client role", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Marek Nowak" }));
    const role = await screen.findByLabelText("Role on the project");
    const options = within(role)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Point of contact", "Site crew", "Supplier", "Architect"]);
    expect(options).not.toContain("Client");
    expect(screen.getByText(/use the client card on the project overview/)).toBeInTheDocument();
  });

  it("assigns the contact with the chosen project, role and client visibility", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Marek Nowak" }));
    fireEvent.change(await screen.findByLabelText("Project"), { target: { value: "p2" } });
    fireEvent.change(screen.getByLabelText("Role on the project"), { target: { value: "poc" } });
    expect(screen.getByRole("switch", { name: "Visible to the client" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Add to project" }));
    await waitFor(() => expect(h.assignContact).toHaveBeenCalledWith("c1", { projectId: "p2", role: "poc", visibleToClient: true }));
  });

  it("only offers the roles the contact doesn't already hold on that project", async () => {
    h.links = {
      c1: [
        {
          id: "l1",
          project_id: "p1",
          role: "crew",
          is_primary: false,
          visible_to_client: false,
          project: { id: "p1", name: "Maple Street" },
        },
        {
          id: "l2",
          project_id: "p1",
          role: "client",
          is_primary: true,
          visible_to_client: false,
          project: { id: "p1", name: "Maple Street" },
        },
      ],
    };
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Marek Nowak" }));
    await screen.findByRole("button", { name: "Remove from Maple Street" });
    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "p1" } });
    const options = within(screen.getByLabelText("Role on the project"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Point of contact", "Supplier", "Architect"]);
  });
});
