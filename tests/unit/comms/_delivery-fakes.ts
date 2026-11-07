// Shared by the T41 email-job tests (instant.test.ts, digest.test.ts): a fake admin Supabase client and claimed rows.
// The claim's SQL (frequency, skipped kinds, windows, recipient cap) is tested in tests/db/notifications_delivery.test.sql;
// here `claims` is what each successive claim_notification_emails call returns.
import type { ClaimedNotification } from "@/server/notifications/deliver.server";

export const SARAH = "a0000000-0000-4000-8000-000000000002"; // client, Polish
export const TOM = "a0000000-0000-4000-8000-000000000003"; // client, English
export const NOBODY = "a0000000-0000-4000-8000-0000000000dd"; // no email address

let seq = 0;
export function claimed(over: Partial<ClaimedNotification>): ClaimedNotification {
  seq += 1;
  return {
    id: `n${seq}`,
    project_id: "p1",
    recipient_id: SARAH,
    kind: "photo_published",
    params: { caption: "Drywall done." },
    title: "New site photo",
    body: "Drywall done.",
    link: "/photos",
    entity_type: "photos",
    entity_id: `ph${seq}`,
    created_at: `2026-11-07T10:${String(seq % 60).padStart(2, "0")}:00Z`,
    read_at: null,
    ...over,
  };
}

export function fakeAdmin(claims: ClaimedNotification[][]) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const emails: Record<string, string> = { [SARAH]: "sarah@renovision.demo", [TOM]: "tom@renovision.demo" };
  const locales: Record<string, string> = { [SARAH]: "pl", [TOM]: "en", [NOBODY]: "en" };
  const projects = [
    { id: "p1", name: "Maple Street" },
    { id: "p2", name: "Oak Avenue" },
  ];
  let call = 0;
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return { data: claims[call++] ?? [], error: null };
    },
    from: (table: string) => {
      const q = {
        select: () => q,
        in: (_column: string, ids: string[]) => {
          const data =
            table === "profiles"
              ? ids.filter((id) => id in locales).map((id) => ({ id, locale: locales[id] }))
              : projects.filter((p) => ids.includes(p.id));
          return Promise.resolve({ data, error: null });
        },
      };
      return q;
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: emails[id] ? { email: emails[id] } : null }, error: null }),
      },
    },
  };
  return { admin: admin as never, rpcCalls };
}
