// The only file in `features/admin` that talks to Supabase: changing an account type through `set_account_type`,
// called as the signed-in user so the database applies its rules (staff only, 2FA, never the last manager).
import { supabase } from "@/lib/supabase";
import type { AccountType } from "../domain/accounts";

/** A failed `set_account_type`; `hint`/`code` carry the database's reason (e.g. `last_staff_account`). */
export class StaffRepoError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

export const staffRepo = {
  async setAccountType(userId: string, type: AccountType): Promise<void> {
    const { error } = await supabase.rpc("set_account_type", { p_user: userId, p_type: type });
    if (error) throw new StaffRepoError(error.message, error.code, error.hint ?? undefined);
  },
};
