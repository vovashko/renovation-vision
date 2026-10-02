import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The enrollment and challenge screens against a mocked `supabase.auth.mfa` (the real repository
// and hooks run on top of it). The router and the session store are stubbed: navigate and the
// session refresh are spies.
const h = vi.hoisted(() => ({
  factors: [] as { id: string; factor_type: string; status: string; friendly_name: string; created_at: string }[],
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      mfa: { listFactors: h.listFactors, enroll: h.enroll, unenroll: h.unenroll, challengeAndVerify: h.challengeAndVerify },
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", userId: "u1", email: "sarah@renovision.demo", aal: "aal1", profile: null, signOut: vi.fn() }),
  useSessionRefresh: () => h.refresh,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => h.navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

// input-otp measures its container; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
document.elementFromPoint ??= () => null;

const { MfaChallengeScreen, MfaEnrollScreen } = await import("@/features/auth/ui/mfa-screens");

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const typeCode = (code: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: code } });

beforeEach(() => {
  h.factors = [];
  h.listFactors.mockReset().mockImplementation(async () => ({ data: { all: h.factors }, error: null }));
  h.enroll.mockReset().mockResolvedValue({
    data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" } },
    error: null,
  });
  h.unenroll.mockReset().mockResolvedValue({ data: {}, error: null });
  h.challengeAndVerify.mockReset().mockResolvedValue({ data: {}, error: null });
  h.navigate.mockReset();
  h.refresh.mockClear();
});

describe("TOTP enrollment", () => {
  it("cleans up stale unverified factors before enrolling a new one", async () => {
    h.factors = [
      { id: "stale-1", factor_type: "totp", status: "unverified", friendly_name: "old", created_at: "2026-09-01T00:00:00Z" },
      { id: "kept", factor_type: "totp", status: "verified", friendly_name: "phone", created_at: "2026-09-02T00:00:00Z" },
    ];
    renderWithQuery(<MfaEnrollScreen redirect="/settings/security" forced={false} />);
    await screen.findByRole("img", { name: /QR code/i });
    expect(h.unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
    expect(h.unenroll).not.toHaveBeenCalledWith({ factorId: "kept" });
    expect(h.unenroll.mock.invocationCallOrder[0]).toBeLessThan(h.enroll.mock.invocationCallOrder[0]);
    expect(h.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: "totp", issuer: "RenoVision" }));
  });

  it("enroll → QR + secret → verify the first code → aal2 → refresh the session → redirect", async () => {
    renderWithQuery(<MfaEnrollScreen redirect="/projects/p1/budget" forced />);
    const qr = await screen.findByRole("img", { name: /QR code/i });
    expect(qr).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
    expect(screen.getByTestId("totp-secret")).toHaveTextContent("JBSWY3DPEHPK3PXP");
    // forced (staff): no way out but signing out
    expect(screen.queryByText("Not now")).not.toBeInTheDocument();

    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify and turn on" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ href: "/projects/p1/budget", replace: true }));
    expect(h.challengeAndVerify).toHaveBeenCalledWith({ factorId: "new-factor", code: "123456" });
    expect(h.refresh).toHaveBeenCalled();
    expect(h.refresh.mock.invocationCallOrder[0]).toBeLessThan(h.navigate.mock.invocationCallOrder[0]);
  });

  it("a wrong code shows a translated error and stays on the screen", async () => {
    h.challengeAndVerify.mockResolvedValue({
      data: null,
      error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" },
    });
    renderWithQuery(<MfaEnrollScreen forced={false} />);
    await screen.findByRole("img", { name: /QR code/i });
    typeCode("000000");
    fireEvent.click(screen.getByRole("button", { name: "Verify and turn on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work");
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("unenrolls the pending factor when the screen is left before verifying", async () => {
    const view = renderWithQuery(<MfaEnrollScreen forced={false} />);
    await screen.findByRole("img", { name: /QR code/i });
    view.unmount();
    await waitFor(() => expect(h.unenroll).toHaveBeenCalledWith({ factorId: "new-factor" }));
  });
});

describe("TOTP challenge (/mfa)", () => {
  it("verifies against the verified factor and continues to the redirect target", async () => {
    h.factors = [{ id: "phone", factor_type: "totp", status: "verified", friendly_name: "phone", created_at: "2026-09-02T00:00:00Z" }];
    renderWithQuery(<MfaChallengeScreen redirect="/projects" />);
    const verify = screen.getByRole("button", { name: "Verify" });
    await waitFor(() => expect(verify).toBeEnabled());
    typeCode("654321");
    await act(async () => fireEvent.click(verify));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ href: "/projects", replace: true }));
    expect(h.challengeAndVerify).toHaveBeenCalledWith({ factorId: "phone", code: "654321" });
  });

  it("never redirects off-site", async () => {
    h.factors = [{ id: "phone", factor_type: "totp", status: "verified", friendly_name: "phone", created_at: "2026-09-02T00:00:00Z" }];
    renderWithQuery(<MfaChallengeScreen redirect="https://evil.example" />);
    const verify = screen.getByRole("button", { name: "Verify" });
    await waitFor(() => expect(verify).toBeEnabled());
    typeCode("654321");
    fireEvent.click(verify);
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ href: "/", replace: true }));
  });
});
