import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShareLinkButton } from "@/shared/ui/share-link-button";
import { useNavRole } from "@/shared/ui/nav-role";

vi.mock("@tanstack/react-router", () => ({ useRouterState: vi.fn() }));
vi.mock("@/shared/ui/nav-role", () => ({ useNavRole: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ID = "b0000000-0000-4000-8000-000000000001";
const writeText = vi.fn();

function setUp(role: "manager" | "client", section = "progress", searchStr = "?view=plan") {
  vi.mocked(useNavRole).mockReturnValue(role);
  vi.mocked(useRouterState).mockImplementation((({ select }: { select: (r: unknown) => unknown }) =>
    select({ location: { pathname: `/projects/${ID}/${section}`, searchStr } })) as never);
  return render(
    <TooltipProvider>
      <ShareLinkButton />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("ShareLinkButton", () => {
  it("lets a manager copy the current page URL, query included", async () => {
    setUp("manager");
    fireEvent.click(screen.getByRole("button", { name: "Copy link for investor" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/projects/${ID}/progress?view=plan`);
  });

  it("shows an error toast when the clipboard is unavailable", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    setUp("manager");
    fireEvent.click(screen.getByRole("button", { name: "Copy link for investor" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("renders nothing for a client", () => {
    const { container } = setUp("client");
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on a manager-only section", () => {
    const { container } = setUp("manager", "budget", "");
    expect(container).toBeEmptyDOMElement();
  });
});
