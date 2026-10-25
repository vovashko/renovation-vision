// listAccounts (T40): every account for the Staff page. Any staff account; the body is in staff.server.ts.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireStaff } from "../middleware/auth";
import { listAccountsHandler } from "./staff.server";

export type { StaffAccount } from "@/features/admin/domain/accounts";

export const listAccounts = authedFn({ method: "GET" })
  .middleware([requireStaff])
  .validator(z.void())
  .handler(async () => listAccountsHandler());
