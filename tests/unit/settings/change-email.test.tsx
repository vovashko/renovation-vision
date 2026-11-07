// Settings → Security's email change (T70) against a mocked Supabase client (real repository and hooks on top):
// validation, the secure-change request with its redirect, the "check both inboxes" state, a confirmation link's
// landing (one side confirmed, or failed) and gotrue's errors.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  user: { email: "sarah@example.com", new_email: null as string | null },
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getUser: h.getUser, updateUser: h.updateUser } } }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ status: "signed-in", userId: "u1", email: h.user.email }) }));

const { ChangeEmailCard } = await import("@/features/settings/ui/change-email-card");
const { changeEmailSchema, emailChangeErrorKey, emailChangeLanding, withoutLandingParams } =
  await import("@/features/settings/domain/email");

function show() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChangeEmailCard />
    </QueryClientProvider>,
  );
}

const authError = (code: string) => Object.assign(new Error(code), { name: "AuthApiError", code, status: 422 });

const submit = (email: string) => {
  fireEvent.change(screen.getByLabelText("New email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
};

beforeEach(() => {
  h.user = { email: "sarah@example.com", new_email: null };
  h.getUser.mockReset().mockImplementation(async () => ({ data: { user: { id: "u1", ...h.user } }, error: null }));
  h.updateUser.mockReset().mockImplementation(async ({ email }: { email: string }) => {
    h.user = { ...h.user, new_email: email };
    return { data: {}, error: null };
  });
  window.history.replaceState(null, "", "/settings/security");
});

describe("email change domain", () => {
  it("needs a valid email other than the current one (case-insensitive), and lowercases it", () => {
    const schema = changeEmailSchema("Sarah@Example.com");
    expect(schema.safeParse({ email: " New@Example.com " })).toMatchObject({ success: true, data: { email: "new@example.com" } });
    expect(schema.safeParse({ email: "sarah@example.com" }).success).toBe(false);
    expect(schema.safeParse({ email: "nope" }).success).toBe(false);
    expect(schema.safeParse({ email: "" }).success).toBe(false);
  });

  it("reads a confirmation link's landing", () => {
    expect(emailChangeLanding("https://app.test/settings/security?message=Confirmation+link+accepted")).toBe("partial");
    expect(emailChangeLanding("https://app.test/settings/security#message=Confirmation+link+accepted")).toBe("partial");
    expect(emailChangeLanding("https://app.test/settings/security?error=access_denied&error_code=otp_expired")).toBe("failed");
    expect(emailChangeLanding("https://app.test/settings/security?code=abc")).toBeNull();
    expect(emailChangeLanding("https://app.test/settings/security")).toBeNull();
  });

  it("drops only what the link added for the page, never a PKCE code", () => {
    expect(withoutLandingParams("https://app.test/settings/security?message=x&code=abc")).toBe(
      "https://app.test/settings/security?code=abc",
    );
    expect(withoutLandingParams("https://app.test/settings/security#error_code=otp_expired&error_description=y")).toBe(
      "https://app.test/settings/security",
    );
  });

  it("translates gotrue's errors", () => {
    expect(emailChangeErrorKey(authError("email_exists"))).toBe("settings:email.inUse");
    expect(emailChangeErrorKey(authError("email_address_invalid"))).toBe("common:form.invalidEmail");
    expect(emailChangeErrorKey(authError("over_email_send_rate_limit"))).toBe("auth:errors.rateLimited");
    expect(emailChangeErrorKey(authError("insufficient_aal"))).toBe("auth:errors.aal2Required");
  });
});

describe("ChangeEmailCard", () => {
  it("shows the current address and refuses the same one", async () => {
    show();
    expect(await screen.findByText("sarah@example.com")).toBeInTheDocument();
    submit("SARAH@example.com");
    expect(await screen.findByText("That's already your email address")).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("asks for a secure change landing back on Settings → Security, then says to check both inboxes", async () => {
    show();
    await screen.findByText("sarah@example.com");
    submit(" New@Example.com ");
    expect(
      await screen.findByText(
        "Check both inboxes: we've sent a confirmation link to sarah@example.com and to new@example.com. Your email changes once you've opened both.",
      ),
    ).toBeInTheDocument();
    expect(h.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: `${window.location.origin}/settings/security` },
    );
    expect(screen.getByLabelText("New email address")).toHaveValue("");
  });

  it("shows a pending change the server reports", async () => {
    h.user = { email: "sarah@example.com", new_email: "next@example.com" };
    show();
    expect(await screen.findByText(/we've sent a confirmation link to sarah@example\.com and to next@example\.com/)).toBeInTheDocument();
  });

  it("after the first confirmation link: one side done, open the other", async () => {
    h.user = { email: "sarah@example.com", new_email: "next@example.com" };
    window.history.replaceState(null, "", "/settings/security?message=Confirmation+link+accepted");
    show();
    expect(
      await screen.findByText("One address is confirmed. Open the link in the other inbox to change your email to next@example.com."),
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("a failed confirmation link says so", async () => {
    window.history.replaceState(null, "", "/settings/security?error=access_denied&error_code=otp_expired");
    show();
    expect(await screen.findByText(/This link is invalid or has expired/)).toBeInTheDocument();
  });

  it("an address with another account", async () => {
    h.updateUser.mockResolvedValueOnce({ data: {}, error: authError("email_exists") });
    show();
    await screen.findByText("sarah@example.com");
    submit("taken@example.com");
    expect(await screen.findByText("This email already has a RenoVision account.")).toBeInTheDocument();
    expect(screen.queryByText(/Check both inboxes/)).not.toBeInTheDocument();
  });
});
