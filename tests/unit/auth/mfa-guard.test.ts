import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

// The real `_authed` beforeLoad and the real resolver (features/auth/hooks → domain/mfa-guard),
// with the MFA repository (Supabase) and the logger mocked.
const h = vi.hoisted(() => ({
  isStaffMfaRequired: vi.fn<() => Promise<boolean>>(),
  listFactors: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/server/functions/session", () => ({ getSession: vi.fn(), getProjectAccess: vi.fn() }));
vi.mock("@/features/auth/data/mfa.repo", () => ({
  mfaRepo: { isStaffMfaRequired: h.isStaffMfaRequired, listFactors: h.listFactors },
}));
vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/logger")>();
  return { ...actual, logger: { ...actual.logger, warn: h.warn } };
});

const { Route: AuthedRoute } = await import("@/routes/_authed");

const VERIFIED = [{ id: "f1", friendlyName: "Phone", status: "verified", createdAt: "2026-10-01T10:00:00Z" }];
const UNVERIFIED = [{ id: "f2", friendlyName: "Phone", status: "unverified", createdAt: "2026-10-01T10:00:00Z" }];

type Hook = (opts: Record<string, unknown>) => unknown;
const beforeLoad = (AuthedRoute.options as unknown as { beforeLoad: Hook }).beforeLoad;

async function run(accountType: "manager" | "admin" | "client", aal: "aal1" | "aal2", queryClient = new QueryClient()) {
  const user = { id: `u-${accountType}`, email: null, aal };
  const auth = { user, profile: { full_name: "X", avatar_url: null, account_type: accountType } };
  try {
    return { returned: await beforeLoad({ context: { auth, queryClient }, location: { href: "/projects/p1/budget" } }) };
  } catch (thrown) {
    return thrown as { options?: { href?: string } };
  }
}

const hrefOf = (outcome: unknown) => (isRedirect(outcome) ? (outcome as { options: { href: string } }).options.href : undefined);

beforeEach(() => {
  h.isStaffMfaRequired.mockReset();
  h.listFactors.mockReset();
  h.warn.mockReset();
});

describe("_authed staff 2FA redirect", () => {
  it("staff + required + aal1 + a verified factor → /mfa (challenge), keeping where they were going", async () => {
    h.isStaffMfaRequired.mockResolvedValue(true);
    h.listFactors.mockResolvedValue(VERIFIED);
    for (const type of ["manager", "admin"] as const) {
      expect(hrefOf(await run(type, "aal1"))).toBe(`/mfa?redirect=${encodeURIComponent("/projects/p1/budget")}`);
    }
  });

  it("staff + required + aal1 + no verified factor (none, or only an abandoned one) → /mfa/enroll", async () => {
    h.isStaffMfaRequired.mockResolvedValue(true);
    h.listFactors.mockResolvedValueOnce([]).mockResolvedValueOnce(UNVERIFIED);
    expect(hrefOf(await run("manager", "aal1"))).toBe(`/mfa/enroll?redirect=${encodeURIComponent("/projects/p1/budget")}`);
    expect(hrefOf(await run("manager", "aal1"))).toMatch(/^\/mfa\/enroll\?/);
  });

  it("staff + not required → pass (factors never asked)", async () => {
    h.isStaffMfaRequired.mockResolvedValue(false);
    expect(await run("manager", "aal1")).toMatchObject({ returned: { user: { aal: "aal1" } } });
    expect(h.listFactors).not.toHaveBeenCalled();
  });

  it("staff + aal2 → pass, without even asking whether 2FA is required", async () => {
    expect(await run("manager", "aal2")).toMatchObject({ returned: { user: { aal: "aal2" } } });
    expect(h.isStaffMfaRequired).not.toHaveBeenCalled();
  });

  it("client → pass (never forced), even with enforcement on", async () => {
    h.isStaffMfaRequired.mockResolvedValue(true);
    expect(await run("client", "aal1")).toMatchObject({ returned: { user: { aal: "aal1" } } });
    expect(h.isStaffMfaRequired).not.toHaveBeenCalled();
  });

  it("RPC error → pass (fail open) with a warning logged", async () => {
    h.isStaffMfaRequired.mockRejectedValue(new Error("permission denied for function staff_mfa_required"));
    expect(await run("manager", "aal1")).toMatchObject({ returned: { user: { id: "u-manager" } } });
    expect(h.warn).toHaveBeenCalledWith(expect.stringContaining("staff_mfa_required"), {
      err: "permission denied for function staff_mfa_required",
    });
  });

  it("caches staff_mfa_required() per session (the query client), not per navigation", async () => {
    h.isStaffMfaRequired.mockResolvedValue(false);
    const queryClient = new QueryClient();
    await run("manager", "aal1", queryClient);
    await run("manager", "aal1", queryClient);
    expect(h.isStaffMfaRequired).toHaveBeenCalledTimes(1);
  });
});
