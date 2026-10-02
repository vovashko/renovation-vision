import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// /reset-password against a mocked Supabase auth client; the router and session store are stubbed.
const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  aal: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: h.getSession,
      verifyOtp: h.verifyOtp,
      updateUser: h.updateUser,
      mfa: { getAuthenticatorAssuranceLevel: h.aal },
    },
  },
}));
vi.mock("@/lib/auth", () => ({ useSessionRefresh: () => h.refresh }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => h.navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

const { ResetPasswordScreen } = await import("@/features/auth/ui/reset-password-screen");

const SESSION = { access_token: "t", user: { id: "u1", factors: [] } };

function show(url: string) {
  window.history.replaceState(null, "", url);
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ResetPasswordScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  h.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  h.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  h.aal.mockReset().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  h.navigate.mockReset();
  h.refresh.mockClear();
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("/reset-password", () => {
  it("an expired link (gotrue's error redirect) → a translated error and a link back to /forgot-password", async () => {
    show("/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(await screen.findByRole("alert")).toHaveTextContent("This link is invalid or has expired");
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("a token_hash that doesn't verify → the same invalid-link state", async () => {
    h.verifyOtp.mockResolvedValue({ data: {}, error: { code: "otp_expired", message: "Email link is invalid or has expired" } });
    show("/reset-password?token_hash=used&type=recovery");
    expect(await screen.findByRole("alert")).toHaveTextContent("This link is invalid or has expired");
  });

  it("a PKCE code the browser couldn't exchange (still in the URL, no session) → invalid", async () => {
    show("/reset-password?code=abc");
    expect(await screen.findByRole("alert")).toHaveTextContent("This link is invalid or has expired");
  });

  it("no link and no session → invalid", async () => {
    show("/reset-password");
    expect(await screen.findByRole("link", { name: "Request a new link" })).toBeInTheDocument();
  });

  it("a valid link → weak password rejected → strong one saved → session refreshed → into the app", async () => {
    h.getSession.mockResolvedValue({ data: { session: SESSION } });
    show("/reset-password?token_hash=fresh&type=recovery");
    const password = await screen.findByLabelText("New password");
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: "fresh", type: "recovery" });

    fireEvent.change(password, { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Repeat the new password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the new password" }));
    expect(await screen.findByText("Use at least 10 characters")).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();

    fireEvent.change(password, { target: { value: "renovation42" } });
    fireEvent.change(screen.getByLabelText("Repeat the new password"), { target: { value: "renovation42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the new password" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
    expect(h.updateUser).toHaveBeenCalledWith({ password: "renovation42" });
    expect(h.refresh).toHaveBeenCalled();
  });

  it("an account with 2FA (aal1 recovery session) is sent through /mfa first", async () => {
    h.getSession.mockResolvedValue({ data: { session: SESSION } });
    h.aal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    show("/reset-password?token_hash=fresh&type=recovery");
    expect(await screen.findByRole("link", { name: "Enter a code" })).toHaveAttribute("href", "/mfa?redirect=%2Freset-password");
  });
});
