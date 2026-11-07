// The notification bell and its inbox (T41), with the comms repository mocked: the unread count badge, the list in
// the user's language across projects, opening a notification (mark read + go to its target), "Mark all read"
// (optimistic), and the realtime feed refreshing both.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { createI18n } from "@/i18n/instance";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InboxNotification } from "@/lib/database.types";

const h = vi.hoisted(() => ({
  inbox: [] as InboxNotification[],
  unread: 0,
  markRead: vi.fn(async (_ids: string[] | null) => {}),
  navigate: vi.fn(async (_opts: { href: string }) => {}),
  onChange: null as null | (() => void),
  unsubscribe: vi.fn(),
  subscribedAs: "" as string,
}));

vi.mock("@/features/comms/data/comms.repo", () => ({
  commsRepo: {
    listInbox: vi.fn(async () => h.inbox),
    unreadCount: vi.fn(async () => h.unread),
    markRead: (ids: string[] | null) => h.markRead(ids),
    subscribeToInbox: (userId: string, onChange: () => void) => {
      h.subscribedAs = userId;
      h.onChange = onChange;
      return h.unsubscribe;
    },
  },
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ userId: "u2", status: "signed-in" }) }));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: h.navigate }),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const { NotificationBellRailItem } = await import("@/features/comms/ui/bell");
const { useInboxRealtime } = await import("@/features/comms/hooks/use-inbox");
const { commsRepo } = await import("@/features/comms/data/comms.repo");

function note(over: Partial<InboxNotification>): InboxNotification {
  return {
    id: "n1",
    project_id: "p1",
    recipient_id: "u2",
    kind: "photo_published",
    params: { caption: "Drywall done." },
    title: "New site photo",
    body: "Drywall done.",
    link: "/photos",
    entity_type: "photos",
    entity_id: "ph1",
    created_at: "2026-11-07T08:00:00Z",
    read_at: null,
    project: { name: "Maple Street" },
    ...over,
  };
}

function setUp(locale: "en" | "pl" = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={createI18n(locale)}>
        <TooltipProvider>{children}</TooltipProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  h.inbox = [
    note({ id: "n1" }),
    note({
      id: "n2",
      project_id: "p2",
      kind: "decision_reopened",
      params: { title: "Extra socket", text: "" },
      link: "/budget",
      entity_type: "decisions",
      entity_id: "r1",
      project: { name: "Oak Avenue" },
    }),
    note({ id: "n3", kind: "manual", params: { title: "Water off", body: "Thursday" }, read_at: "2026-11-07T09:00:00Z" }),
  ];
  h.unread = 2;
  h.markRead.mockClear();
  h.navigate.mockClear();
  h.unsubscribe.mockClear();
  vi.mocked(commsRepo.listInbox).mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("the bell", () => {
  it("shows the unread count and opens the inbox, in the user's language, naming projects when there are several", async () => {
    const { wrapper } = setUp("pl");
    render(<NotificationBellRailItem />, { wrapper });
    const bell = await screen.findByRole("button", { name: "Powiadomienia, nieprzeczytane: 2" });
    expect(bell).toHaveTextContent("2");
    expect(commsRepo.listInbox).not.toHaveBeenCalled(); // loaded when opened

    fireEvent.click(bell);
    const sheet = await screen.findByRole("dialog", { name: "Powiadomienia" });
    expect(await within(sheet).findByText("Nowe zdjęcie z budowy")).toBeInTheDocument();
    expect(within(sheet).getByText("Wznowiono: Extra socket")).toBeInTheDocument();
    expect(within(sheet).getByText("Oak Avenue")).toBeInTheDocument();
    expect(within(sheet).getAllByText("Nieprzeczytane")).toHaveLength(2); // the read one has no marker
  });

  it("no unread: a plain label, no badge", async () => {
    h.unread = 0;
    const { wrapper } = setUp();
    render(<NotificationBellRailItem />, { wrapper });
    await waitFor(() => expect(commsRepo.unreadCount).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Notifications" })).not.toHaveTextContent(/\d/);
  });
});

describe("the inbox", () => {
  it("opening a notification marks it read and goes to its target (the change request)", async () => {
    const { wrapper } = setUp();
    render(<NotificationBellRailItem />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    fireEvent.click(await within(sheet).findByRole("button", { name: /Reopened: Extra socket/ }));
    await waitFor(() => expect(h.markRead).toHaveBeenCalledWith(["n2"]));
    expect(h.navigate).toHaveBeenCalledWith({ href: "/projects/p2/budget?request=r1" });
  });

  it("opening a read notification only navigates", async () => {
    const { wrapper } = setUp();
    render(<NotificationBellRailItem />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    fireEvent.click(await within(sheet).findByRole("button", { name: /Water off/ }));
    expect(h.navigate).toHaveBeenCalledWith({ href: "/projects/p1/photos" });
    expect(h.markRead).not.toHaveBeenCalled();
  });

  it("Mark all read: every row and the badge clear at once", async () => {
    let release: () => void = () => {};
    h.markRead.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
    const { wrapper } = setUp();
    render(<NotificationBellRailItem />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    await within(sheet).findByText("New site photo");
    fireEvent.click(within(sheet).getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(h.markRead).toHaveBeenCalledWith(null));
    await waitFor(() => expect(within(sheet).queryByText("Unread")).not.toBeInTheDocument());
    // The badge is gone (the bell sits behind the open sheet, so it is aria-hidden for now).
    expect(screen.getByRole("button", { name: "Notifications", hidden: true })).not.toHaveTextContent(/\d/);
    h.unread = 0;
    h.inbox = h.inbox.map((n) => ({ ...n, read_at: n.read_at ?? "2026-11-07T10:00:00Z" }));
    await act(async () => release());
    expect(within(sheet).getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });

  it("empty", async () => {
    h.inbox = [];
    h.unread = 0;
    const { wrapper } = setUp();
    render(<NotificationBellRailItem />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});

describe("useInboxRealtime", () => {
  it("subscribes for the signed-in user, refetches the count on a change, and unsubscribes", async () => {
    const { wrapper } = setUp();
    render(<NotificationBellRailItem />, { wrapper });
    const { unmount } = renderHook(() => useInboxRealtime(), { wrapper });
    await screen.findByRole("button", { name: "Notifications, 2 unread" });
    expect(h.subscribedAs).toBe("u2");
    h.unread = 5;
    act(() => h.onChange?.());
    expect(await screen.findByRole("button", { name: "Notifications, 5 unread" })).toBeInTheDocument();
    unmount();
    expect(h.unsubscribe).toHaveBeenCalled();
  });
});
