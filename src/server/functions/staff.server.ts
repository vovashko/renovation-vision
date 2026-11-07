// The Staff page's account list (T40), read with the admin client: auth.users isn't reachable through the API, and
// profiles RLS only shows project peers. Only the fields the page shows leave the server (see toStaffAccounts).
// Changing an account type is NOT done here: the page calls `set_account_type` as the user, so its staff, 2FA and
// last-manager rules apply.
import { getAdminSupabase } from "@/lib/supabase/admin";
import { toStaffAccounts, type AuthUserLike, type ProfileLike, type StaffAccount } from "@/features/admin/domain/accounts";

const PER_PAGE = 1000;

export async function listAccountsHandler(): Promise<StaffAccount[]> {
  const admin = getAdminSupabase();
  const users: AuthUserLike[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at })));
    if (data.users.length < PER_PAGE) break;
  }
  const { data: profiles, error } = await admin.from("profiles").select("id, full_name, account_type");
  if (error) throw new Error(error.message);
  return toStaffAccounts(users, (profiles ?? []) as ProfileLike[]);
}
