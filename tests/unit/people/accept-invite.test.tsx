// The accept-invite flow (T40): verify the link's token (renewing gotrue's token when only that expired), set the
// password and metadata, accept through the RPC; dead ends become translated statuses on /accept-invite.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const TOKEN = "a".repeat(56);
const NEW_TOKEN = "b".repeat(56);

const h = vi.hoisted(() => ({
  verifyLink: vi.fn(async (_token: string) => {}),
  saveAccount: vi.fn(async (_input: unknown) => {}),
  accept: vi.fn(async (_input: { tokenHash: string }) => "b0000000-0000-4000-8000-000000000001" as string | null),
  sessionEmail: vi.fn(async () => null as string | null),
  renewInviteToken: vi.fn(async (_args: unknown) => ({ status: "renewed", tokenHash: "b".repeat(56) }) as Record<string, unknown>),
  lookupInvite: vi.fn(async (_args: unknown) => ({ status: "expired" }) as Record<string, unknown>),
}));

class FakeRepoError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

vi.mock("@/features/people/data/invites.repo", () => ({
  invitesRepo: {
    verifyLink: h.verifyLink,
    saveAccount: h.saveAccount,
    accept: h.accept,
    sessionEmail: h.sessionEmail,
    listPending: vi.fn(),
  },
}));
vi.mock("@/features/people/data/people.repo", () => ({ PeopleRepoError: FakeRepoError, peopleRepo: {} }));
vi.mock("@/server/functions/invites", () => ({
  renewInviteToken: h.renewInviteToken,
  lookupInvite: h.lookupInvite,
  inviteMember: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useSessionRefresh: () => async () => {} }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => async () => {},
}));

// The Radix checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const { acceptInvite } = await import("@/features/people/hooks/invites");
const { InviteAcceptScreen } = await import("@/features/people/ui/invite-accept-screen");

const authError = (code: string) => Object.assign(new Error(code), { name: "AuthApiError", code, status: 403 });
const input = { tokenHash: TOKEN, signedIn: false, fullName: "Sarah Bennett", locale: "en" as const, password: "renovation2026" };

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockClear();
  h.verifyLink.mockImplementation(async () => {});
  h.accept.mockImplementation(async () => "b0000000-0000-4000-8000-000000000001");
});

describe("acceptInvite", () => {
  it("verifies the link, saves the password and profile, then accepts with the privacy consent", async () => {
    expect(await acceptInvite(input)).toEqual({ status: "accepted", projectId: "b0000000-0000-4000-8000-000000000001" });
    expect(h.verifyLink).toHaveBeenCalledWith(TOKEN);
    expect(h.saveAccount).toHaveBeenCalledWith({ password: "renovation2026", fullName: "Sarah Bennett", locale: "en" });
    expect(h.accept).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: TOKEN, fullName: "Sarah Bennett", locale: "en", privacyVersion: expect.any(String) }),
    );
    expect(h.renewInviteToken).not.toHaveBeenCalled();
  });

  it("renews gotrue's expired token while the invitation is still pending, and accepts with the new one", async () => {
    h.verifyLink.mockImplementationOnce(async () => {
      throw authError("otp_expired");
    });
    expect(await acceptInvite(input)).toMatchObject({ status: "accepted" });
    expect(h.renewInviteToken).toHaveBeenCalledWith({ data: { tokenHash: TOKEN } });
    expect(h.verifyLink).toHaveBeenLastCalledWith(NEW_TOKEN);
    expect(h.accept).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: NEW_TOKEN }));
  });

  it("stops at the renewal's answer: needs sign-in, expired, used", async () => {
    for (const status of ["needs_sign_in", "expired", "used"]) {
      h.verifyLink.mockImplementationOnce(async () => {
        throw authError("otp_expired");
      });
      h.renewInviteToken.mockResolvedValueOnce({ status });
      expect(await acceptInvite(input)).toEqual({ status });
    }
    expect(h.saveAccount).not.toHaveBeenCalled();
    expect(h.accept).not.toHaveBeenCalled();
  });

  it("rethrows other sign-in failures (rate limits, network)", async () => {
    h.verifyLink.mockImplementationOnce(async () => {
      throw authError("over_request_rate_limit");
    });
    await expect(acceptInvite(input)).rejects.toThrow("over_request_rate_limit");
    expect(h.renewInviteToken).not.toHaveBeenCalled();
  });

  it("skips the token and keeps the password for someone already signed in as the invitee", async () => {
    await acceptInvite({ ...input, signedIn: true });
    expect(h.verifyLink).not.toHaveBeenCalled();
    expect(h.saveAccount).toHaveBeenCalledWith({ password: undefined, fullName: "Sarah Bennett", locale: "en" });
  });

  it("turns the RPC's used, expired and withdrawn answers into statuses", async () => {
    for (const [hint, status] of [
      ["invite_used", "used"],
      ["invite_expired", "expired"],
      ["invite_revoked", "revoked"],
      ["invite_invalid", "invalid"],
    ]) {
      h.accept.mockRejectedValueOnce(new FakeRepoError("no", hint));
      expect(await acceptInvite(input)).toEqual({ status });
    }
    h.accept.mockRejectedValueOnce(new FakeRepoError("no", "invite_email_mismatch"));
    await expect(acceptInvite(input)).rejects.toThrow("no");
  });
});

function renderScreen(tokenHash: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InviteAcceptScreen tokenHash={tokenHash} />
    </QueryClientProvider>,
  );
}

describe("InviteAcceptScreen", () => {
  it.each([
    ["expired", /has expired\. Ask your manager to send a new one/],
    ["used", /already accepted\. Sign in/],
    ["revoked", /was withdrawn/],
    ["invalid", /link isn't valid/],
  ])("explains a %s link", async (status, text) => {
    h.lookupInvite.mockResolvedValueOnce({ status });
    renderScreen(TOKEN);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept and continue" })).not.toBeInTheDocument();
  });

  it("treats a malformed token as invalid without asking the server", async () => {
    renderScreen("not-a-token");
    expect(await screen.findByText(/link isn't valid/)).toBeInTheDocument();
    expect(h.lookupInvite).not.toHaveBeenCalled();
  });

  it("shows the form for a pending invitation, with the project and inviter", async () => {
    h.lookupInvite.mockResolvedValueOnce({
      status: "pending",
      email: "sarah@example.com",
      role: "client",
      projectName: "Maple Street",
      inviterName: "Jonas Weber",
    });
    renderScreen(TOKEN);
    expect(await screen.findByText("Jonas Weber invited you to follow Maple Street in RenoVision.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept and continue" })).toBeInTheDocument();
  });
});
