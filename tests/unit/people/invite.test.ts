// Invites (T40): the schemas and status rules, and the invite server handlers against a mocked admin client:
// the manager-invite staff gate, the client-email check, token handling (only sha256 of the link token is stored,
// never logged), expired / used / revoked / invalid lookups, renewing gotrue's token, and revoke's cleanup.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFnError } from "@/server/errors";
import type { AuthContext } from "@/server/middleware/auth";
import {
  acceptInviteSchema,
  inviteMemberInput,
  inviteStatus,
  INVITE_TTL_DAYS,
  isTokenHash,
  statusForError,
} from "@/features/people/domain/invites";

const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const INVITATION_ID = "90000000-0000-4000-8000-000000000001";
const USER_ID = "a0000000-0000-4000-8000-000000000001";
const TOKEN = "a".repeat(56);
const NEW_TOKEN = "b".repeat(56);

type Op = { method: string; args: unknown[] };
type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
type Resolver = (table: string, ops: Op[]) => Result;

/** A thenable query-builder stand-in: records every call; `resolve(table, ops)` decides what the query returns. */
function fakeClient(resolve: Resolver, rpc: (fn: string, args: unknown) => Result = () => ({})) {
  const queries: { table: string; ops: Op[] }[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const from = (table: string) => {
    const ops: Op[] = [];
    queries.push({ table, ops });
    const done = () => Promise.resolve({ data: null, error: null, count: null, ...resolve(table, ops) });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "update", "insert", "delete"]) {
      q[m] = (...args: unknown[]) => {
        ops.push({ method: m, args });
        return q;
      };
    }
    q.maybeSingle = () => done();
    q.single = () => done();
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => done().then(ok, ko);
    return q;
  };
  return {
    from,
    queries,
    rpcCalls,
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return { data: null, error: null, ...rpc(fn, args) };
    },
  };
}

const has = (ops: Op[], method: string, ...args: unknown[]) =>
  ops.some((op) => op.method === method && args.every((a, i) => JSON.stringify(op.args[i]) === JSON.stringify(a)));

const h = vi.hoisted(() => ({
  admin: undefined as unknown,
  sent: [] as { to: string; template: string; locale: string; params: Record<string, unknown> }[],
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestUrl: () => new URL("https://app.renovision.test/projects/x/team"),
  getRequestHeader: () => undefined,
  getCookies: () => ({}),
  setCookie: () => {},
}));
vi.mock("@/lib/supabase/server", () => ({ getJwtVerifier: () => ({}), createServerSupabase: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminSupabase: () => h.admin }));
vi.mock("@/server/email/send-email.server", () => ({
  sendEmail: async (input: (typeof h.sent)[number]) => void h.sent.push(input),
}));

const { hashInviteToken, inviteMemberHandler, lookupInviteHandler, renewInviteTokenHandler, resendInviteHandler, revokeInviteHandler } =
  await import("@/server/functions/invites.server");

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 1000).toISOString();

type AdminOpts = {
  account?: { user_id: string; confirmed: boolean; invited: boolean; signed_in: boolean } | null;
  linkError?: { message: string; code?: string };
  invitation?: Record<string, unknown> | null;
  openInvitation?: { id: string } | null;
  otherOpen?: number;
};

function fakeAdmin(opts: AdminOpts = {}) {
  const generateLink = vi.fn(async (_args: unknown) =>
    opts.linkError
      ? { data: { properties: null, user: null }, error: opts.linkError }
      : {
          data: { properties: { hashed_token: generateLink.mock.calls.length > 1 ? NEW_TOKEN : TOKEN }, user: { id: USER_ID } },
          error: null,
        },
  );
  const deleteUser = vi.fn(async (_id: string) => ({ data: {}, error: null }));
  const client = fakeClient(
    (table, ops) => {
      if (table === "invitations") {
        if (has(ops, "insert")) return { data: { id: INVITATION_ID } };
        if (has(ops, "update")) return {};
        if (ops.some((op) => op.method === "select" && (op.args[1] as { head?: boolean } | undefined)?.head))
          return { count: opts.otherOpen ?? 0 };
        if (ops.some((op) => op.method === "eq" && op.args[0] === "token_hash")) return { data: opts.invitation ?? null };
        return { data: opts.openInvitation ?? null };
      }
      if (table === "projects") return { data: { name: "Maple Street" } };
      if (table === "profiles") return { data: { full_name: "Jonas Weber" } };
      return {};
    },
    (fn) => (fn === "invite_account_state" ? { data: opts.account ? [opts.account] : [] } : {}),
  );
  return Object.assign(client, { auth: { admin: { generateLink, deleteUser } } });
}

/** The manager's own (RLS) client: their account type, the project's client contact, its name, and the invitation. */
function fakeUser(
  opts: { accountType?: string; clientEmail?: string | null; invitation?: Record<string, unknown> | null; revoked?: boolean } = {},
) {
  return fakeClient(
    (table, ops) => {
      if (table === "profiles")
        return has(ops, "select", "account_type")
          ? { data: { account_type: opts.accountType ?? "admin" } }
          : { data: { full_name: "Jonas Weber" } };
      if (table === "project_contacts")
        return { data: opts.clientEmail === null ? null : { contact: { email: opts.clientEmail ?? "new.client@example.com" } } };
      if (table === "projects") return { data: { name: "Maple Street" } };
      if (table === "invitations") return { data: opts.invitation ?? null };
      return {};
    },
    (fn) => (fn === "revoke_invitation" ? { data: opts.revoked ?? true } : {}),
  );
}

const ctx = (supabase: unknown): AuthContext =>
  ({ user: { id: USER_ID, email: "jonas@renovision.demo", aal: "aal2", role: "authenticated" }, supabase }) as unknown as AuthContext;

async function rejection(promise: Promise<unknown>): Promise<ServerFnError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ServerFnError);
    return e as ServerFnError;
  }
  throw new Error("expected a rejection");
}

beforeEach(() => {
  h.sent = [];
  h.admin = fakeAdmin();
});

describe("schemas", () => {
  it("normalizes the invite input and rejects unknown roles and languages", () => {
    const ok = inviteMemberInput.parse({ projectId: PROJECT_ID, email: "  New.Client@Example.com ", role: "client", locale: "pl" });
    expect(ok.email).toBe("new.client@example.com");
    expect(inviteMemberInput.safeParse({ projectId: PROJECT_ID, email: "x@example.com", role: "admin", locale: "pl" }).success).toBe(false);
    expect(inviteMemberInput.safeParse({ projectId: PROJECT_ID, email: "x@example.com", role: "client", locale: "de" }).success).toBe(
      false,
    );
    expect(inviteMemberInput.safeParse({ projectId: "nope", email: "x@example.com", role: "client", locale: "en" }).success).toBe(false);
  });

  it("accepts only hex token hashes", () => {
    expect(isTokenHash(TOKEN)).toBe(true);
    expect(isTokenHash("not-a-token")).toBe(false);
    expect(isTokenHash("")).toBe(false);
    expect(isTokenHash(null)).toBe(false);
  });

  it("needs a new password and the privacy consent, unless already signed in as the invitee", () => {
    const base = { fullName: "Sarah Bennett", locale: "en", privacy: true };
    const withPassword = acceptInviteSchema(true);
    expect(withPassword.safeParse({ ...base, password: "renovation2026", confirm: "renovation2026" }).success).toBe(true);
    expect(withPassword.safeParse({ ...base, password: "short1", confirm: "short1" }).success).toBe(false);
    expect(withPassword.safeParse({ ...base, password: "renovation2026", confirm: "renovation2027" }).success).toBe(false);
    expect(withPassword.safeParse({ ...base, privacy: false, password: "renovation2026", confirm: "renovation2026" }).success).toBe(false);
    expect(acceptInviteSchema(false).safeParse(base).success).toBe(true);
    expect(acceptInviteSchema(false).safeParse({ ...base, fullName: "  " }).success).toBe(false);
  });
});

describe("inviteStatus / statusForError", () => {
  const row = (over: Partial<{ accepted_at: string | null; revoked_at: string | null; expires_at: string }> = {}) => ({
    accepted_at: null,
    revoked_at: null,
    expires_at: future(),
    ...over,
  });

  it("tells pending, expired, used, revoked and invalid apart", () => {
    expect(inviteStatus(row())).toBe("pending");
    expect(inviteStatus(row({ expires_at: past() }))).toBe("expired");
    expect(inviteStatus(row({ accepted_at: past() }))).toBe("used");
    expect(inviteStatus(row({ accepted_at: past(), expires_at: past() }))).toBe("used");
    expect(inviteStatus(row({ revoked_at: past(), accepted_at: past() }))).toBe("revoked");
    expect(inviteStatus(null)).toBe("invalid");
  });

  it("maps the RPC's hints to the accept page's dead ends", () => {
    expect(statusForError("invite_expired")).toBe("expired");
    expect(statusForError("invite_used")).toBe("used");
    expect(statusForError("invite_revoked")).toBe("revoked");
    expect(statusForError("invite_invalid")).toBe("invalid");
    expect(statusForError("consent_required")).toBeNull();
    expect(statusForError(undefined)).toBeNull();
  });
});

describe("hashInviteToken", () => {
  it("is sha256(token) as hex: what accept_invitation computes in SQL", async () => {
    expect(await hashInviteToken(TOKEN)).toBe(sha256(TOKEN));
  });
});

describe("inviteMemberHandler", () => {
  it("only lets staff accounts invite managers (checked on the server, before any account is created)", async () => {
    const error = await rejection(
      inviteMemberHandler(
        { projectId: PROJECT_ID, email: "pm@example.com", role: "manager", locale: "en" },
        ctx(fakeUser({ accountType: "client" })),
      ),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(error.reason).toBe("staff_required");
    expect((h.admin as ReturnType<typeof fakeAdmin>).auth.admin.generateLink).not.toHaveBeenCalled();
    expect(h.sent).toEqual([]);
  });

  it("invites a manager: stores only sha256 of the link token, and emails the accept-invite link", async () => {
    const result = await inviteMemberHandler(
      { projectId: PROJECT_ID, email: "PM@Example.com", role: "manager", locale: "en" },
      ctx(fakeUser({ accountType: "admin" })),
    );
    const admin = h.admin as ReturnType<typeof fakeAdmin>;
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({
      type: "invite",
      email: "pm@example.com",
      options: { data: { locale: "en" } },
    });
    const insert = admin.queries.find((q) => q.table === "invitations" && has(q.ops, "insert"))!;
    const row = insert.ops.find((op) => op.method === "insert")!.args[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      email: "pm@example.com",
      role: "manager",
      project_id: PROJECT_ID,
      invited_by: USER_ID,
      token_hash: sha256(TOKEN),
    });
    expect(JSON.stringify(row)).not.toContain(TOKEN);
    const days = (new Date(row.expires_at as string).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(INVITE_TTL_DAYS - 0.01);
    expect(days).toBeLessThanOrEqual(INVITE_TTL_DAYS);

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "pm@example.com", template: "invite", locale: "en" });
    expect(h.sent[0].params).toMatchObject({
      inviteUrl: `https://app.renovision.test/accept-invite?token_hash=${TOKEN}&type=invite`,
      projectName: "Maple Street",
      inviterName: "Jonas Weber",
      role: "manager",
    });
    expect(result).toMatchObject({ id: INVITATION_ID, email: "pm@example.com", role: "manager" });
  });

  it("renews the open invitation for the same email instead of adding a second one", async () => {
    h.admin = fakeAdmin({ openInvitation: { id: INVITATION_ID } });
    await inviteMemberHandler({ projectId: PROJECT_ID, email: "new.client@example.com", role: "client", locale: "pl" }, ctx(fakeUser()));
    const admin = h.admin as ReturnType<typeof fakeAdmin>;
    expect(admin.queries.some((q) => q.table === "invitations" && has(q.ops, "insert"))).toBe(false);
    const update = admin.queries.find((q) => q.table === "invitations" && has(q.ops, "update"))!;
    expect(update.ops.find((op) => op.method === "update")!.args[0]).toMatchObject({ token_hash: sha256(TOKEN) });
    expect(has(update.ops, "eq", "id", INVITATION_ID)).toBe(true);
  });

  it("only invites the project's client contact email as a client", async () => {
    const error = await rejection(
      inviteMemberHandler(
        { projectId: PROJECT_ID, email: "someone.else@example.com", role: "client", locale: "pl" },
        ctx(fakeUser({ clientEmail: "new.client@example.com" })),
      ),
    );
    expect(error.reason).toBe("invite_not_project_client");
    expect(h.sent).toEqual([]);
  });

  it("refuses an email that already has a confirmed account", async () => {
    h.admin = fakeAdmin({ account: { user_id: USER_ID, confirmed: true, invited: false, signed_in: true } });
    const error = await rejection(
      inviteMemberHandler({ projectId: PROJECT_ID, email: "new.client@example.com", role: "client", locale: "pl" }, ctx(fakeUser())),
    );
    expect(error.reason).toBe("account_exists");
    expect((h.admin as ReturnType<typeof fakeAdmin>).auth.admin.generateLink).not.toHaveBeenCalled();
  });

  it("maps gotrue's email_exists to account_exists", async () => {
    h.admin = fakeAdmin({ linkError: { message: "already registered", code: "email_exists" } });
    const error = await rejection(
      inviteMemberHandler({ projectId: PROJECT_ID, email: "new.client@example.com", role: "client", locale: "pl" }, ctx(fakeUser())),
    );
    expect(error.reason).toBe("account_exists");
  });
});

describe("resendInviteHandler / revokeInviteHandler", () => {
  const open = { id: INVITATION_ID, email: "new.client@example.com", role: "client", accepted_at: null, revoked_at: null };

  it("resends a pending invitation and refuses an accepted or withdrawn one", async () => {
    await resendInviteHandler({ projectId: PROJECT_ID, invitationId: INVITATION_ID, locale: "pl" }, ctx(fakeUser({ invitation: open })));
    expect(h.sent).toHaveLength(1);
    const used = await rejection(
      resendInviteHandler(
        { projectId: PROJECT_ID, invitationId: INVITATION_ID, locale: "pl" },
        ctx(fakeUser({ invitation: { ...open, accepted_at: past() } })),
      ),
    );
    expect(used.reason).toBe("invite_used");
    const missing = await rejection(
      resendInviteHandler({ projectId: PROJECT_ID, invitationId: INVITATION_ID, locale: "pl" }, ctx(fakeUser())),
    );
    expect(missing.code).toBe("NOT_FOUND");
  });

  it("revokes as the user, then deletes the account the invite created when it was never used", async () => {
    h.admin = fakeAdmin({ account: { user_id: "u-new", confirmed: false, invited: true, signed_in: false } });
    const user = fakeUser({ invitation: open });
    await revokeInviteHandler({ projectId: PROJECT_ID, invitationId: INVITATION_ID }, ctx(user));
    expect(user.rpcCalls).toEqual([{ fn: "revoke_invitation", args: { p_invitation: INVITATION_ID } }]);
    expect((h.admin as ReturnType<typeof fakeAdmin>).auth.admin.deleteUser).toHaveBeenCalledWith("u-new");
  });

  it("keeps an account that signed in, or that another open invitation still points at", async () => {
    h.admin = fakeAdmin({ account: { user_id: "u-new", confirmed: true, invited: true, signed_in: true } });
    await revokeInviteHandler({ projectId: PROJECT_ID, invitationId: INVITATION_ID }, ctx(fakeUser({ invitation: open })));
    expect((h.admin as ReturnType<typeof fakeAdmin>).auth.admin.deleteUser).not.toHaveBeenCalled();

    h.admin = fakeAdmin({ account: { user_id: "u-new", confirmed: false, invited: true, signed_in: false }, otherOpen: 1 });
    await revokeInviteHandler({ projectId: PROJECT_ID, invitationId: INVITATION_ID }, ctx(fakeUser({ invitation: open })));
    expect((h.admin as ReturnType<typeof fakeAdmin>).auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("reports an invitation that was no longer pending", async () => {
    const error = await rejection(
      revokeInviteHandler({ projectId: PROJECT_ID, invitationId: INVITATION_ID }, ctx(fakeUser({ invitation: open, revoked: false }))),
    );
    expect(error.reason).toBe("invite_used");
  });
});

describe("lookupInviteHandler", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: INVITATION_ID,
    email: "new.client@example.com",
    role: "client",
    project_id: PROJECT_ID,
    invited_by: USER_ID,
    expires_at: future(),
    accepted_at: null,
    revoked_at: null,
    ...over,
  });

  it("finds the invitation by sha256 of the link token and says who it's for", async () => {
    h.admin = fakeAdmin({ invitation: row() });
    expect(await lookupInviteHandler({ tokenHash: TOKEN })).toEqual({
      status: "pending",
      email: "new.client@example.com",
      role: "client",
      projectName: "Maple Street",
      inviterName: "Jonas Weber",
    });
    const lookup = (h.admin as ReturnType<typeof fakeAdmin>).queries.find((q) => q.table === "invitations")!;
    expect(has(lookup.ops, "eq", "token_hash", sha256(TOKEN))).toBe(true);
  });

  it("answers expired, used, revoked and invalid links with the status only", async () => {
    for (const [over, status] of [
      [{ expires_at: past() }, "expired"],
      [{ accepted_at: past() }, "used"],
      [{ revoked_at: past() }, "revoked"],
    ] as const) {
      h.admin = fakeAdmin({ invitation: row(over) });
      expect(await lookupInviteHandler({ tokenHash: TOKEN })).toEqual({ status });
    }
    h.admin = fakeAdmin({ invitation: null });
    expect(await lookupInviteHandler({ tokenHash: TOKEN })).toEqual({ status: "invalid" });
  });
});

describe("renewInviteTokenHandler", () => {
  const pending = {
    id: INVITATION_ID,
    email: "new.client@example.com",
    role: "client",
    expires_at: future(),
    accepted_at: null,
    revoked_at: null,
  };

  it("issues a fresh gotrue token for a pending invitation and points the row at it", async () => {
    h.admin = fakeAdmin({ invitation: pending, account: { user_id: "u-new", confirmed: false, invited: true, signed_in: false } });
    const admin = h.admin as ReturnType<typeof fakeAdmin>;
    admin.auth.admin.generateLink.mockResolvedValueOnce({
      data: { properties: { hashed_token: NEW_TOKEN }, user: { id: "u-new" } },
      error: null,
    } as never);
    expect(await renewInviteTokenHandler({ tokenHash: TOKEN })).toEqual({ status: "renewed", tokenHash: NEW_TOKEN });
    const update = admin.queries.find((q) => q.table === "invitations" && has(q.ops, "update"))!;
    expect(update.ops.find((op) => op.method === "update")!.args[0]).toEqual({ token_hash: sha256(NEW_TOKEN) });
  });

  it("sends a confirmed invitee to sign in, and never renews a dead invitation", async () => {
    h.admin = fakeAdmin({ invitation: pending, account: { user_id: "u-new", confirmed: true, invited: true, signed_in: true } });
    expect(await renewInviteTokenHandler({ tokenHash: TOKEN })).toEqual({ status: "needs_sign_in" });
    h.admin = fakeAdmin({ invitation: { ...pending, expires_at: past() } });
    expect(await renewInviteTokenHandler({ tokenHash: TOKEN })).toEqual({ status: "expired" });
    expect((h.admin as ReturnType<typeof fakeAdmin>).auth.admin.generateLink).not.toHaveBeenCalled();
  });
});
