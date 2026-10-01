import { beforeEach, describe, expect, it, vi } from "vitest";
import { isNotFound, isRedirect } from "@tanstack/react-router";

// The route guards' real beforeLoad/loader hooks, with the session and role loaders mocked: the
// session arrives as `context.auth` (root beforeLoad), the role via ensureProjectAccess.
const h = vi.hoisted(() => ({ ensureProjectAccess: vi.fn() }));
vi.mock("@/server/functions/session", () => ({ getSession: vi.fn(), getProjectAccess: vi.fn() }));
vi.mock("@/features/auth/hooks", () => ({ ensureProjectAccess: h.ensureProjectAccess, useProjectRole: () => null }));

const { Route: AuthedRoute } = await import("@/routes/_authed");
const { Route: LoginRoute } = await import("@/routes/login");
const { Route: ProjectRoute } = await import("@/routes/project/layout");
const { safeRedirectTarget, projectGuard, projectSection } = await import("@/features/auth/domain/guards");

const P = "b0000000-0000-4000-8000-000000000001";
const USER = { id: "u-1", email: "jonas@renovision.demo", aal: "aal1" as const };
const SIGNED_IN = { user: USER, profile: { full_name: "Jonas Weber", avatar_url: null, account_type: "manager" as const } };
const SIGNED_OUT = { user: null, profile: null };

type Hook = (opts: Record<string, unknown>) => unknown;
const beforeLoadOf = (route: { options: unknown }) => (route.options as { beforeLoad: Hook }).beforeLoad;
const loaderOf = (route: { options: unknown }) => (route.options as { loader: Hook }).loader;

/** Runs a hook and returns what it threw (a redirect / notFound), or `{ returned }`. */
async function outcome(run: () => unknown) {
  try {
    return { returned: await run() };
  } catch (thrown) {
    return thrown as Record<string, unknown>;
  }
}

beforeEach(() => h.ensureProjectAccess.mockReset());

describe("_authed layout", () => {
  it("redirects a signed-out visitor to /login?redirect=<where they were going>", async () => {
    const thrown = await outcome(() =>
      beforeLoadOf(AuthedRoute)({ context: { auth: SIGNED_OUT }, location: { href: `/projects/${P}/budget?x=1` } }),
    );
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: unknown }).options).toMatchObject({ to: "/login", search: { redirect: `/projects/${P}/budget?x=1` } });
  });

  it("lets a signed-in user through and hands children a non-null user", async () => {
    await expect(outcome(() => beforeLoadOf(AuthedRoute)({ context: { auth: SIGNED_IN }, location: { href: "/" } }))).resolves.toEqual({
      returned: { user: USER },
    });
  });
});

describe("/login", () => {
  it("sends a signed-in user to the redirect target", async () => {
    const thrown = await outcome(() => beforeLoadOf(LoginRoute)({ context: { auth: SIGNED_IN }, search: { redirect: `/projects/${P}` } }));
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: unknown }).options).toMatchObject({ href: `/projects/${P}` });
  });

  it("sends a signed-in user home when there is no (or an unsafe) redirect", async () => {
    for (const redirect of [undefined, "https://evil.example", "//evil.example", "/\\evil.example", "/login?redirect=/x"]) {
      const thrown = await outcome(() => beforeLoadOf(LoginRoute)({ context: { auth: SIGNED_IN }, search: { redirect } }));
      expect((thrown as { options: unknown }).options).toMatchObject({ href: "/" });
    }
  });

  it("renders the sign-in screen for a signed-out visitor", async () => {
    await expect(outcome(() => beforeLoadOf(LoginRoute)({ context: { auth: SIGNED_OUT }, search: {} }))).resolves.toEqual({
      returned: undefined,
    });
  });
});

describe("project layout guard", () => {
  const run = async (role: "manager" | "client" | null, path: string) => {
    h.ensureProjectAccess.mockResolvedValue({ role, project: null });
    const context = { queryClient: {}, user: USER };
    const before = await outcome(() => beforeLoadOf(ProjectRoute)({ context, params: { projectId: P }, location: { pathname: path } }));
    if (!("returned" in before)) return before;
    return outcome(() => loaderOf(ProjectRoute)({ context: { ...context, ...(before.returned as object) } }));
  };

  it("loads the per-project role for the signed-in user", async () => {
    await run("manager", `/projects/${P}`);
    expect(h.ensureProjectAccess).toHaveBeenCalledWith({}, P, USER.id);
  });

  it("not a member → not found (the 'Project not available' page)", async () => {
    expect(isNotFound(await run(null, `/projects/${P}`))).toBe(true);
    expect(isNotFound(await run(null, `/projects/${P}/budget`))).toBe(true);
  });

  it("a client on a manager-only section → redirect to the project overview", async () => {
    for (const section of ["budget", "updates", "knowledge", "team"]) {
      const thrown = await run("client", `/projects/${P}/${section}`);
      expect(isRedirect(thrown)).toBe(true);
      expect((thrown as { options: unknown }).options).toMatchObject({ to: "/projects/$projectId", params: { projectId: P } });
    }
  });

  it("a client on a shared section → allowed", async () => {
    for (const section of ["", "progress", "photos", "design", "chat"]) {
      expect(await run("client", `/projects/${P}${section ? `/${section}` : ""}`)).toEqual({ returned: undefined });
    }
  });

  it("a manager → allowed everywhere", async () => {
    for (const section of ["", "progress", "budget", "updates", "knowledge", "team"]) {
      expect(await run("manager", `/projects/${P}${section ? `/${section}` : ""}`)).toEqual({ returned: undefined });
    }
  });
});

describe("guard helpers", () => {
  it("projectSection reads the segment after the project id", () => {
    expect(projectSection(`/projects/${P}`)).toBe("");
    expect(projectSection(`/projects/${P}/budget`)).toBe("budget");
  });

  it("projectGuard covers the matrix", () => {
    expect(projectGuard(null, "")).toBe("not-found");
    expect(projectGuard("client", "budget")).toBe("overview");
    expect(projectGuard("client", "chat")).toBe("allow");
    expect(projectGuard("manager", "budget")).toBe("allow");
  });

  it("safeRedirectTarget only allows same-origin paths", () => {
    expect(safeRedirectTarget("/projects?x=1#y")).toBe("/projects?x=1#y");
    expect(safeRedirectTarget(42)).toBe("/");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/");
  });
});
