import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { loadProjectAccess } from "@/server/functions/session.server";
import type { AuthContext } from "@/server/middleware/auth";

// A manager ACCOUNT (profiles.account_type = "manager") who is only a CLIENT on this project
// (project_members.role = "client") must get the client role, and with it the client nav.
const h = vi.hoisted(() => ({ params: {} as { projectId?: string }, getProjectAccess: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useParams: () => h.params }));
vi.mock("@/server/functions/session", () => ({ getProjectAccess: h.getProjectAccess, getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    userId: "u-1",
    email: "jonas@renovision.demo",
    profile: { id: "u-1", full_name: "Jonas Weber", avatar_url: null, account_type: "manager" },
  }),
}));

const { useNavRole, navRoleFor } = await import("@/shared/ui/nav-role");
const { navItemsFor } = await import("@/shared/ui/nav-config");

const P = "b0000000-0000-4000-8000-000000000001";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  h.params = {};
  h.getProjectAccess.mockReset();
});

describe("per-project role", () => {
  it("is read from project_members for the user and project, not from profiles.account_type", async () => {
    const queries: unknown[][] = [];
    const supabase = {
      from: (table: string) => {
        const filters: unknown[] = [table];
        const builder = {
          select: (columns: string) => (filters.push(columns), builder),
          eq: (column: string, value: string) => (filters.push(column, value), builder),
          maybeSingle: async () => {
            queries.push(filters);
            if (table === "project_members") return { data: { role: "client" }, error: null };
            if (table === "project_summary")
              return { data: { id: P, name: "Maple Street Apartment", budget: "100", spent: "5" }, error: null };
            return { data: { account_type: "manager" }, error: null }; // never asked
          },
        };
        return builder;
      },
    };
    const context = { user: { id: "u-1", email: null, aal: "aal1", role: "authenticated" }, supabase } as unknown as AuthContext;
    const access = await loadProjectAccess(context, P);
    expect(access.role).toBe("client");
    expect(access.project).toMatchObject({ name: "Maple Street Apartment", budget: 100, spent: 5 });
    expect(queries).toContainEqual(["project_members", "role", "project_id", P, "user_id", "u-1"]);
    expect(queries.some((q) => q[0] === "profiles")).toBe(false);
  });

  it("a non-member gets no role and no project", async () => {
    const supabase = {
      from: (table: string) => {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: table === "project_summary" ? { id: P } : null, error: null }),
        };
        return builder;
      },
    };
    const context = { user: { id: "u-1" }, supabase } as unknown as AuthContext;
    await expect(loadProjectAccess(context, P)).resolves.toEqual({ role: null, project: null });
  });
});

describe("nav role", () => {
  it("a manager account that is a client on this project gets the client nav", async () => {
    h.params = { projectId: P };
    h.getProjectAccess.mockResolvedValue({ role: "client", project: null });
    const { result } = renderHook(() => useNavRole(), { wrapper });
    await waitFor(() => expect(h.getProjectAccess).toHaveBeenCalledWith({ data: { projectId: P } }));
    await waitFor(() => expect(result.current).toBe("client"));
    expect(navItemsFor(result.current).map((i) => i.key)).not.toContain("budget");
  });

  it("the same account managing the project gets the manager nav", async () => {
    h.params = { projectId: P };
    h.getProjectAccess.mockResolvedValue({ role: "manager", project: null });
    const { result } = renderHook(() => useNavRole(), { wrapper });
    await waitFor(() => expect(result.current).toBe("manager"));
  });

  it("outside a project, account_type decides (managers see /projects)", () => {
    const { result } = renderHook(() => useNavRole(), { wrapper });
    expect(result.current).toBe("manager");
    expect(h.getProjectAccess).not.toHaveBeenCalled();
    expect(navRoleFor(null, false, "client")).toBe("client");
  });

  it("inside a project, falls back to the least-privileged role while the role loads", () => {
    expect(navRoleFor(null, true, "manager")).toBe("client");
  });
});
