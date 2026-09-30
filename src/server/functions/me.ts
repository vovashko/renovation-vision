// getMe: who the server thinks the caller is. The proof that the whole chain works end to end:
// browser session → Bearer header → requireUser (getClaims) → default rate limit → a profiles query
// as the user (RLS). Returns `{ id, email, aal, accountType }`.
import { z } from "zod";
import { authedFn } from "../fn";
import { loadMe } from "./me.server";

export type { Me } from "./me.server";

export const getMe = authedFn({ method: "GET" })
  .validator(z.void()) // takes no input; still declared, by convention
  .handler(async ({ context }) => loadMe(context));
