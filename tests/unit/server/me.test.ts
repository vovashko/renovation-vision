import { describe, expect, it } from "vitest";
import { loadMe } from "@/server/functions/me.server";
import type { AuthContext } from "@/server/middleware/auth";

function contextWith(accountType: string | null): AuthContext {
  const supabase = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            expect([table, columns, column, value]).toEqual(["profiles", "account_type", "id", "user-1"]);
            return { data: accountType ? { account_type: accountType } : null, error: null };
          },
        }),
      }),
    }),
  };
  return { user: { id: "user-1", email: "jonas@renovision.demo", aal: "aal2", role: "authenticated" }, supabase } as unknown as AuthContext;
}

describe("getMe (loadMe)", () => {
  it("returns the verified user plus their account type, read as the user", async () => {
    await expect(loadMe(contextWith("manager"))).resolves.toEqual({ id: "user-1", email: "jonas@renovision.demo", aal: "aal2", accountType: "manager" });
  });

  it("reports a missing profile as a null account type", async () => {
    await expect(loadMe(contextWith(null))).resolves.toMatchObject({ accountType: null });
  });
});
