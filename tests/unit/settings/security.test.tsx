import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Settings → Security against a mocked Supabase client (real repositories and hooks on top).
const h = vi.hoisted(() => ({
  updateUser: vi.fn(),
  reauthenticate: vi.fn(),
  listFactors: vi.fn(),
  unenroll: vi.fn(),
  rpc: vi.fn(),
  auth: { aal: "aal2" as "aal1" | "aal2", accountType: "manager" as "manager" | "client" | "admin" },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: h.rpc,
    auth: { updateUser: h.updateUser, reauthenticate: h.reauthenticate, mfa: { listFactors: h.listFactors, unenroll: h.unenroll } },
  },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    userId: "u1",
    email: "jonas@renovision.demo",
    aal: h.auth.aal,
    profile: { id: "u1", full_name: "Jonas", avatar_url: null, account_type: h.auth.accountType },
    signOut: vi.fn(),
  }),
  useSessionRefresh: () => async () => {},
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
document.elementFromPoint ??= () => null;

const { ChangePasswordCard } = await import("@/features/settings/ui/change-password-card");
const { TwoFactorCard } = await import("@/features/settings/ui/two-factor-card");
const { removeRule } = await import("@/features/settings/domain/two-factor");
const { ConfirmProvider } = await import("@/shared/ui/confirm-dialog");

function show(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </QueryClientProvider>,
  );
}

const factor = (id: string, status: "verified" | "unverified") => ({
  id,
  factor_type: "totp",
  status,
  friendly_name: `App ${id}`,
  created_at: "2026-09-02T00:00:00Z",
});

beforeEach(() => {
  h.updateUser.mockReset();
  h.reauthenticate.mockReset().mockResolvedValue({ data: {}, error: null });
  h.listFactors.mockReset().mockResolvedValue({ data: { all: [] }, error: null });
  h.unenroll.mockReset().mockResolvedValue({ data: {}, error: null });
  h.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  h.auth.aal = "aal2";
  h.auth.accountType = "manager";
});

describe("change password", () => {
  const fill = (password: string) => {
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Repeat the new password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  };

  it("a recent session: changes it directly", async () => {
    h.updateUser.mockResolvedValue({ data: {}, error: null });
    show(<ChangePasswordCard />);
    fill("renovation42");
    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
    expect(h.updateUser).toHaveBeenCalledWith({ password: "renovation42" });
    expect(h.reauthenticate).not.toHaveBeenCalled();
  });

  it("reauthentication needed → emails a code → updateUser({ password, nonce })", async () => {
    h.updateUser
      .mockResolvedValueOnce({ data: {}, error: { code: "reauthentication_needed", message: "Password update requires reauthentication" } })
      .mockResolvedValueOnce({ data: {}, error: { code: "reauthentication_not_valid", message: "Verification code incorrect" } })
      .mockResolvedValueOnce({ data: {}, error: null });
    show(<ChangePasswordCard />);
    fill("renovation42");

    expect(await screen.findByText(/we've emailed you a 6-digit code/)).toBeInTheDocument();
    expect(h.reauthenticate).toHaveBeenCalledTimes(1);

    const code = screen.getByRole("textbox");
    fireEvent.change(code, { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code is wrong or has expired");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "424242" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
    expect(h.updateUser).toHaveBeenLastCalledWith({ password: "renovation42", nonce: "424242" });
  });

  it("an account with 2FA on an aal1 session is told to verify first", async () => {
    h.updateUser.mockResolvedValue({ data: {}, error: { code: "insufficient_aal", message: "AAL2 session is required" } });
    show(<ChangePasswordCard />);
    fill("renovation42");
    expect(await screen.findByRole("link", { name: "Verify with your authenticator app" })).toHaveAttribute(
      "href",
      "/mfa?redirect=%2Fsettings%2Fsecurity",
    );
  });
});

describe("two-factor card", () => {
  it("staff with enforcement on can't remove their last verified factor", async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    h.listFactors.mockResolvedValue({ data: { all: [factor("only", "verified")] }, error: null });
    show(<TwoFactorCard />);
    const row = await screen.findByTestId("mfa-factor");
    await waitFor(() => expect(within(row).getByRole("button", { name: "Remove" })).toBeDisabled());
    expect(screen.getByText(/required for staff accounts/)).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith("staff_mfa_required");
  });

  it("a client (never enforced) on aal2 can remove it, after confirming", async () => {
    h.auth.accountType = "client";
    h.listFactors.mockResolvedValue({ data: { all: [factor("only", "verified")] }, error: null });
    show(<TwoFactorCard />);
    const row = await screen.findByTestId("mfa-factor");
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(h.unenroll).toHaveBeenCalledWith({ factorId: "only" }));
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("removeRule: unverified always, aal1 must verify first, enforced staff locked on the last one", () => {
    const opts = { aal: "aal2" as const, verifiedCount: 1, enforcedForMe: false };
    expect(removeRule({ status: "unverified" }, { ...opts, enforcedForMe: true })).toBe("allowed");
    expect(removeRule({ status: "verified" }, opts)).toBe("allowed");
    expect(removeRule({ status: "verified" }, { ...opts, aal: "aal1" })).toBe("verify-first");
    expect(removeRule({ status: "verified" }, { ...opts, enforcedForMe: true })).toBe("locked");
    expect(removeRule({ status: "verified" }, { ...opts, enforcedForMe: true, verifiedCount: 2 })).toBe("allowed");
  });
});
