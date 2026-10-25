// Internally an account is a `client` or an `admin`; the product calls `admin` "Manager".
// Mirrors `private.is_staff()` in SQL. The per-project role (`project_members.role`) is separate.

/** Whether an account type is the staff type (`admin`). */
export function isStaff(accountType: string | null | undefined): boolean {
  return accountType === "admin";
}
