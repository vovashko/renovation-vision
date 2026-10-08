import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { BottomNav } from "@/shared/ui/bottom-nav";
import { useAuth } from "@/lib/auth";
import { useProjectRole } from "@/features/auth/hooks";
import { useParams, useRouterState } from "@tanstack/react-router";

// BottomNav renders router `<Link>`s and reads route state; stub the router so this stays a unit
// test of the role-aware nav, not a routing test (same approach as tests/unit/knowledge/ai-answer.test.tsx).
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { projectId?: string };
    [k: string]: unknown;
  }) => (
    <a href={typeof to === "string" ? to.replace("$projectId", params?.projectId ?? "") : "#"} {...props}>
      {children}
    </a>
  ),
  useParams: vi.fn(),
  useRouterState: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
// Inside a project the nav follows the per-project role (project_members), not account_type.
vi.mock("@/features/auth/hooks", () => ({ useProjectRole: vi.fn() }));
// The Decisions row carries the client's pending count (a query); stub it, the badge has its own test below.
const pendingDecisions = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/features/decisions/hooks", () => ({ usePendingDecisionCount: () => ({ data: pendingDecisions.count }) }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseParams = vi.mocked(useParams);
const mockedUseRouterState = vi.mocked(useRouterState);

function setUp({ role, path, projectId }: { role: "manager" | "client"; path: string; projectId?: string }) {
  mockedUseAuth.mockReturnValue({
    status: "signed-in",
    userId: "u1",
    email: "jane@example.com",
    profile: { id: "u1", full_name: "Jane Doe", avatar_url: null, account_type: role },
    aal: "aal1",
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useProjectRole).mockReturnValue(projectId ? role : null);
  mockedUseParams.mockReturnValue({ projectId } as unknown as ReturnType<typeof useParams>);
  // @ts-expect-error -- test double: only the `select` shape BottomNav actually calls is implemented.
  mockedUseRouterState.mockImplementation(({ select }) => select({ location: { pathname: path } }));
}

beforeEach(() => {
  pendingDecisions.count = 0;
  mockedUseAuth.mockReset();
  mockedUseParams.mockReset();
  mockedUseRouterState.mockReset();
});

describe("BottomNav", () => {
  it("shows the same four tabs plus More for both roles", () => {
    for (const role of ["client", "manager"] as const) {
      setUp({ role, path: "/projects/p1", projectId: "p1" });
      const { unmount } = render(<BottomNav />);
      for (const label of ["Overview", "Progress", "Photos", "Chat"]) {
        expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
      }
      expect(screen.getByRole("button", { name: "More pages" })).toBeInTheDocument();
      // Manager-only sections never show up as a tab, for either role.
      expect(screen.queryByRole("link", { name: "Budget" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("marks the current section active with aria-current", () => {
    setUp({ role: "manager", path: "/projects/p1/progress", projectId: "p1" });
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Progress" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Photos" })).not.toHaveAttribute("aria-current");
  });

  it("stays active on Progress regardless of the ?view= search param (pathname only)", () => {
    // The router mock only ever sees the pathname (search isn't part of location.pathname), which
    // is exactly why comparing pathnames already makes Progress active for any `view`.
    setUp({ role: "client", path: "/projects/p1/progress", projectId: "p1" });
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Progress" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the More sheet with the client's sections (no All projects, no Budget)", async () => {
    setUp({ role: "client", path: "/projects/p1", projectId: "p1" });
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Design" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Decisions" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "All projects" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Budget" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("opens the More sheet with every manager section plus All projects", async () => {
    setUp({ role: "manager", path: "/projects/p1", projectId: "p1" });
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    const dialog = await screen.findByRole("dialog");
    for (const label of ["Design", "Budget", "Decisions", "Updates", "AI knowledge", "Team", "All projects", "Settings"]) {
      expect(within(dialog).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the client's pending decisions as a count on the Decisions row, and none for a manager", async () => {
    pendingDecisions.count = 3;
    setUp({ role: "client", path: "/projects/p1", projectId: "p1" });
    const { unmount } = render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    const clientDialog = await screen.findByRole("dialog");
    expect(within(clientDialog).getByRole("link", { name: /Decisions/ })).toHaveTextContent("3");
    unmount();

    setUp({ role: "manager", path: "/projects/p1", projectId: "p1" });
    render(<BottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    const managerDialog = await screen.findByRole("dialog");
    expect(within(managerDialog).getByRole("link", { name: "Decisions" })).not.toHaveTextContent("3");
  });

  it("falls back to a single back link outside a project", () => {
    setUp({ role: "manager", path: "/projects", projectId: undefined });
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More pages" })).not.toBeInTheDocument();
  });
});
