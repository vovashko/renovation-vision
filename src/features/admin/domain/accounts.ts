// The Staff page's account list (T40): pure mapping from the auth users and profiles the server reads with the admin
// client to just what the page shows. No Supabase, no React.

export type AccountType = "admin" | "client";

/** One row of the Staff page. `invited`: the account was created by an invite that hasn't been accepted yet. */
export type StaffAccount = { id: string; name: string; email: string; accountType: AccountType; invited: boolean };

export type AuthUserLike = { id: string; email?: string | null; email_confirmed_at?: string | null };
export type ProfileLike = { id: string; full_name: string; account_type: AccountType };

/** Accounts with a profile, managers first, then by name (or email). Nothing else from auth.users leaves the server. */
export function toStaffAccounts(users: AuthUserLike[], profiles: ProfileLike[]): StaffAccount[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const rows: StaffAccount[] = [];
  for (const user of users) {
    const profile = byId.get(user.id);
    if (!profile) continue;
    rows.push({
      id: user.id,
      name: profile.full_name.trim(),
      email: user.email ?? "",
      accountType: profile.account_type,
      invited: !user.email_confirmed_at,
    });
  }
  const label = (a: StaffAccount) => (a.name || a.email).toLocaleLowerCase();
  return rows.sort((a, b) => Number(b.accountType === "admin") - Number(a.accountType === "admin") || label(a).localeCompare(label(b)));
}

/** The other account type: what the row's action switches to. */
export const otherType = (type: AccountType): AccountType => (type === "admin" ? "client" : "admin");

/** Hints `set_account_type` raises that the page explains. */
export type AccountTypeError = "last_staff_account" | "mfa_required" | "forbidden";

export function accountTypeError(error: { code?: string; hint?: string | null; message?: string }): AccountTypeError | null {
  if (error.hint === "last_staff_account") return "last_staff_account";
  if (error.code === "42501" && /two-factor/i.test(error.message ?? "")) return "mfa_required";
  if (error.code === "42501") return "forbidden";
  return null;
}
