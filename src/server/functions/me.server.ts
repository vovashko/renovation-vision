import { loadAccountType } from "../auth.server";
import type { AccountType, Aal, AuthContext } from "../middleware/auth";

export type Me = { id: string; email: string | null; aal: Aal; accountType: AccountType | null };

/** getMe's handler body: the verified user plus their account type, read as the user (RLS). */
export async function loadMe(context: AuthContext): Promise<Me> {
  const { user } = context;
  return { id: user.id, email: user.email, aal: user.aal, accountType: await loadAccountType(context) };
}
