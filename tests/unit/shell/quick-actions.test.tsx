import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuickActions } from "@/shared/ui/quick-actions";
import { useNavRole } from "@/shared/ui/nav-role";
import { useParams, useRouterState } from "@tanstack/react-router";

// QuickActions reads route state and the nav role directly; stub both so this stays a unit test of
// the FAB's visibility rules and wiring, not routing or auth.
vi.mock("@tanstack/react-router", () => ({
  useParams: vi.fn(),
  useRouterState: vi.fn(),
}));
vi.mock("@/shared/ui/nav-role", () => ({ useNavRole: vi.fn() }));
vi.mock("@/lib/queries", () => ({ useStages: () => ({ data: [] }), useRooms: () => ({ data: [] }) }));

// The upload/expense sheets have their own coverage (media/budget); stub them here to a minimal
// dialog so this test only asserts that QuickActions opens the right one.
vi.mock("@/features/media/ui/photo-upload-sheet", () => ({
  UploadSheet: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div role="dialog" aria-label="upload-sheet-stub">
        <button onClick={() => onOpenChange(false)}>close upload</button>
      </div>
    ) : null,
}));
vi.mock("@/features/budget/ui/expense-sheet", () => ({
  ExpenseSheet: ({ expense, onClose }: { expense: "new" | null; onClose: () => void }) =>
    expense ? (
      <div role="dialog" aria-label="expense-sheet-stub">
        <button onClick={onClose}>close expense</button>
      </div>
    ) : null,
}));

const mockedUseNavRole = vi.mocked(useNavRole);
const mockedUseParams = vi.mocked(useParams);
const mockedUseRouterState = vi.mocked(useRouterState);

function setUp({ role, path, projectId }: { role: "manager" | "client"; path: string; projectId?: string }) {
  mockedUseNavRole.mockReturnValue(role);
  mockedUseParams.mockReturnValue({ projectId } as unknown as ReturnType<typeof useParams>);
  // @ts-expect-error -- test double: only the `select` shape QuickActions actually calls is implemented.
  mockedUseRouterState.mockImplementation(({ select }) => select({ location: { pathname: path } }));
}

beforeEach(() => {
  mockedUseNavRole.mockReset();
  mockedUseParams.mockReset();
  mockedUseRouterState.mockReset();
});

describe("QuickActions", () => {
  it("renders nothing for a client", () => {
    setUp({ role: "client", path: "/projects/p1", projectId: "p1" });
    const { container } = render(<QuickActions />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing outside a project", () => {
    setUp({ role: "manager", path: "/projects", projectId: undefined });
    const { container } = render(<QuickActions />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on the chat page", () => {
    setUp({ role: "manager", path: "/projects/p1/chat", projectId: "p1" });
    const { container } = render(<QuickActions />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the FAB for a manager inside a project, off the chat page", () => {
    setUp({ role: "manager", path: "/projects/p1", projectId: "p1" });
    render(<QuickActions />);
    expect(screen.getByRole("button", { name: "Quick actions" })).toBeInTheDocument();
  });

  it("opens the upload sheet from the menu", async () => {
    setUp({ role: "manager", path: "/projects/p1", projectId: "p1" });
    render(<QuickActions />);
    fireEvent.click(screen.getByRole("button", { name: "Quick actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Upload photo" }));
    expect(await screen.findByLabelText("upload-sheet-stub")).toBeInTheDocument();
  });

  it("opens the expense sheet from the menu", async () => {
    setUp({ role: "manager", path: "/projects/p1", projectId: "p1" });
    render(<QuickActions />);
    fireEvent.click(screen.getByRole("button", { name: "Quick actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    expect(await screen.findByLabelText("expense-sheet-stub")).toBeInTheDocument();
  });
});
