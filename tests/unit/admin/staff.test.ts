// The Staff page (T40): the account list mapping (only what the page shows), the admin-client listing with paging,
// promote/demote through `set_account_type` as the user, and the translated toasts (last manager, 2FA).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  rpc: vi.fn(async (_fn: string, _args: unknown) => ({ data: null, error: null as unknown })),
  admin: undefined as unknown,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  refresh: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: h.rpc } }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminSupabase: () => h.admin }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ userId: "me" }), useSessionRefresh: () => h.refresh }));
vi.mock("@/server/functions/staff", () => ({ listAccounts: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

const { toStaffAccounts, accountTypeError, otherType } = await import("@/features/admin/domain/accounts");
const { listAccountsHandler } = await import("@/server/functions/staff.server");
const { staffRepo, StaffRepoError } = await import("@/features/admin/data/staff.repo");
const { useSetAccountType } = await import("@/features/admin/hooks");

beforeEach(() => {
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
  h.toastError.mockClear();
  h.toastSuccess.mockClear();
  h.refresh.mockClear();
});

describe("toStaffAccounts", () => {
  const users = [
    { id: "c1", email: "sarah@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", phone: "+48", app_metadata: { provider: "email" } },
    { id: "m2", email: "zofia@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" },
    { id: "m1", email: "adam@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" },
    { id: "i1", email: "new@example.com", email_confirmed_at: null },
    { id: "orphan", email: "noprofile@example.com", email_confirmed_at: null },
  ];
  const profiles = [
    { id: "c1", full_name: "Sarah Bennett", account_type: "client" as const },
    { id: "m2", full_name: "Zofia Nowak", account_type: "admin" as const },
    { id: "m1", full_name: " Adam Kowalski ", account_type: "admin" as const },
    { id: "i1", full_name: "", account_type: "client" as const },
  ];

  it("lists accounts with a profile, managers first, then by name or email", () => {
    expect(toStaffAccounts(users, profiles).map((a) => a.id)).toEqual(["m1", "m2", "i1", "c1"]);
  });

  it("returns only what the page shows, and flags invites that weren't accepted", () => {
    const [adam] = toStaffAccounts(users, profiles);
    expect(adam).toEqual({ id: "m1", name: "Adam Kowalski", email: "adam@example.com", accountType: "admin", invited: false });
    const invited = toStaffAccounts(users, profiles).find((a) => a.id === "i1")!;
    expect(invited.invited).toBe(true);
    for (const row of toStaffAccounts(users, profiles))
      expect(Object.keys(row).sort()).toEqual(["accountType", "email", "id", "invited", "name"]);
  });

  it("switches to the other type", () => {
    expect(otherType("admin")).toBe("client");
    expect(otherType("client")).toBe("admin");
  });
});

describe("listAccountsHandler", () => {
  it("pages through auth.users with the admin client and joins the profiles", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, email: `u${i}@example.com`, email_confirmed_at: "2026-01-01" }));
    const page2 = [{ id: "last", email: "last@example.com", email_confirmed_at: "2026-01-01" }];
    const listUsers = vi.fn(async ({ page }: { page: number }) => ({ data: { users: page === 1 ? page1 : page2 }, error: null }));
    h.admin = {
      auth: { admin: { listUsers } },
      from: () => ({ select: async () => ({ data: [{ id: "last", full_name: "Last One", account_type: "admin" }], error: null }) }),
    };
    expect(await listAccountsHandler()).toEqual([
      { id: "last", name: "Last One", email: "last@example.com", accountType: "admin", invited: false },
    ]);
    expect(listUsers.mock.calls.map(([args]) => args)).toEqual([
      { page: 1, perPage: 1000 },
      { page: 2, perPage: 1000 },
    ]);
  });
});

describe("staffRepo.setAccountType", () => {
  it("promotes and demotes through set_account_type on the user's own client", async () => {
    await staffRepo.setAccountType("u1", "admin");
    await staffRepo.setAccountType("u1", "client");
    expect(h.rpc.mock.calls).toEqual([
      ["set_account_type", { p_user: "u1", p_type: "admin" }],
      ["set_account_type", { p_user: "u1", p_type: "client" }],
    ]);
  });

  it("keeps the database's code and hint", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "last", code: "42501", hint: "last_staff_account" } });
    const error = await staffRepo.setAccountType("u1", "client").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StaffRepoError);
    expect(accountTypeError(error as InstanceType<typeof StaffRepoError>)).toBe("last_staff_account");
  });
});

describe("accountTypeError", () => {
  it("names the last-manager, 2FA and permission failures", () => {
    expect(accountTypeError({ code: "42501", hint: "last_staff_account" })).toBe("last_staff_account");
    expect(accountTypeError({ code: "42501", message: "Two-factor verification required" })).toBe("mfa_required");
    expect(accountTypeError({ code: "42501", message: "Only manager accounts can change account types" })).toBe("forbidden");
    expect(accountTypeError({ code: "P0002", message: "No account" })).toBeNull();
  });
});

describe("useSetAccountType", () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, children);
  const account = { id: "u1", name: "Zofia Nowak", email: "zofia@example.com", accountType: "admin" as const, invited: false };

  it("toasts the last-manager rule when the database refuses a demotion", async () => {
    h.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "The last manager account can't be demoted", code: "42501", hint: "last_staff_account" },
    });
    const { result } = renderHook(() => useSetAccountType(), { wrapper });
    act(() => result.current.mutate({ account, type: "client" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(h.toastError.mock.calls[0][0]).toMatch(/last manager account/);
    expect(h.rpc).toHaveBeenCalledWith("set_account_type", { p_user: "u1", p_type: "client" });
  });

  it("confirms a promotion, and refreshes the session only after changing your own type", async () => {
    const { result } = renderHook(() => useSetAccountType(), { wrapper });
    act(() => result.current.mutate({ account: { ...account, accountType: "client" }, type: "admin" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Zofia Nowak is now a manager"));
    expect(h.refresh).not.toHaveBeenCalled();
    act(() => result.current.mutate({ account: { ...account, id: "me" }, type: "client" }));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });
});
