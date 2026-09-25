import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, selectCls } from "@/components/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/visibility-badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useActivity, useMembers, useNotifications, useSave } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import type { Notification } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/updates")({
  head: () => ({
    meta: [
      { title: "Updates — RenoTrack Manager" },
      { name: "description", content: "Notifications sent to the client and the internal activity log." },
    ],
  }),
  component: UpdatesPage,
});

const links = [
  { value: "/", label: "Overview" },
  { value: "/stages", label: "Stages" },
  { value: "/plan", label: "Plan" },
  { value: "/photos", label: "Photos" },
  { value: "/design", label: "Design" },
  { value: "/chat", label: "Chat" },
];

function UpdatesPage() {
  const { projectId } = Route.useParams();
  const { userId } = useAuth();
  const { data: notifications, isLoading } = useNotifications(projectId);
  const { data: activity = [] } = useActivity(projectId);
  const { data: members = [] } = useMembers(projectId);
  const [form, setForm] = useState({ title: "", body: "", link: "/" });
  const send = useSave(projectId, () => api.notifyClients(projectId, form.title.trim(), form.body.trim(), form.link || null), {
    invalidate: [],
    success: "Sent to your client",
  });

  if (isLoading || !notifications) return <PageLoading />;
  const clientIds = new Set(members.filter((m) => m.role === "client").map((m) => m.user_id));
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.profile.full_name ?? "System";

  // One notification is fanned out per client; group them back into one "sent" item.
  const sent = new Map<string, { n: Notification; total: number; read: number }>();
  for (const n of notifications.filter((x) => clientIds.has(x.recipient_id))) {
    const k = `${n.created_at}|${n.title}`;
    const g = sent.get(k) ?? { n, total: 0, read: 0 };
    g.total += 1;
    if (n.read_at) g.read += 1;
    sent.set(k, g);
  }
  const inbox = notifications.filter((n) => n.recipient_id === userId);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader title="Updates" description="Status changes, published photos and new renders notify your client automatically." />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form
          className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate(undefined, { onSuccess: () => setForm({ title: "", body: "", link: "/" }) });
          }}
        >
          <h2 className="flex items-center gap-2 font-semibold"><Icon name="send" size={20} /> Send an announcement</h2>
          <Field id="nt-title" label="Title"><Input id="nt-title" required maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Water off on Thursday" className="h-11" /></Field>
          <Field id="nt-body" label="Message"><Textarea id="nt-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
          <Field id="nt-link" label="Opens in the client app">
            <select id="nt-link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={selectCls}>
              {links.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
          <Button type="submit" disabled={!form.title.trim() || send.isPending || clientIds.size === 0} className="min-h-11 w-full">
            {clientIds.size === 0 ? "Invite a client first" : `Send to ${clientIds.size} client${clientIds.size > 1 ? "s" : ""}`}
          </Button>
        </form>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold"><Icon name="notifications" size={22} /> Sent to client</h2>
          {sent.size === 0 ? (
            <EmptyState icon="notifications" text="No notifications sent yet." />
          ) : (
            <ul className="space-y-3">
              {[...sent.values()].map(({ n, total, read }) => (
                <li key={n.id} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-medium">{n.title}</div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{n.kind}</span>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {dateTime(n.created_at)} · read by {read} of {total}{n.link ? ` · opens ${links.find((l) => l.value === n.link)?.label ?? n.link}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {inbox.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-xl font-semibold">Your inbox</h2>
              <ul className="space-y-2">
                {inbox.slice(0, 10).map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 text-sm shadow-[var(--shadow-soft)]">
                    <div><div className="font-medium">{n.title}</div><div className="text-muted-foreground">{n.body}</div></div>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateTime(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-xl font-semibold"><Icon name="history" size={22} /> Activity log <InternalBadge /></h2>
        {activity.length === 0 ? (
          <EmptyState icon="history" text="Changes to this project will be listed here." />
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="text-sm font-medium">{a.summary}</div>
                {Object.keys(a.changes).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {Object.entries(a.changes).slice(0, 4).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {k.replace(/_/g, " ")}: {String(v.from ?? "—").slice(0, 24)} → {String(v.to ?? "—").slice(0, 24)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">{nameOf(a.actor_id)} · {dateTime(a.created_at)}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
