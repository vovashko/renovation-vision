import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { ActivityLog } from "@/features/comms/ui/activity-log";
import { AnnouncementForm, type AnnouncementFormState } from "@/features/comms/ui/announcement-form";
import { InboxNotificationItem, SentNotificationItem } from "@/features/comms/ui/notification-item";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useActivity, useMembers, useNotifications, useSave } from "@/lib/queries";
import type { Notification } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/updates")({
  head: () => ({
    meta: [
      { title: "Updates — RenoVision" },
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
  const [form, setForm] = useState<AnnouncementFormState>({ title: "", body: "", link: "/" });
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
        <AnnouncementForm
          form={form}
          onChange={setForm}
          pending={send.isPending}
          clientCount={clientIds.size}
          links={links}
          onSubmit={() => send.mutate(undefined, { onSuccess: () => setForm({ title: "", body: "", link: "/" }) })}
        />

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-title-lg">
            <Icon name="notifications" size={22} /> Sent to client
          </h2>
          {sent.size === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" icon="notifications" />
                <EmptyDescription>No notifications sent yet.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup>
              {[...sent.values()].map(({ n, total, read }) => (
                <SentNotificationItem
                  key={n.id}
                  notification={n}
                  total={total}
                  read={read}
                  linkLabel={n.link ? (links.find((l) => l.value === n.link)?.label ?? n.link) : undefined}
                />
              ))}
            </ItemGroup>
          )}
          {inbox.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-title-lg">Your inbox</h2>
              <ItemGroup>
                {inbox.slice(0, 10).map((n) => (
                  <InboxNotificationItem key={n.id} notification={n} />
                ))}
              </ItemGroup>
            </>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-title-lg">
          <Icon name="history" size={22} /> Activity log <InternalBadge />
        </h2>
        {activity.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" icon="history" />
              <EmptyDescription>Changes to this project will be listed here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ActivityLog activity={activity} nameOf={nameOf} />
        )}
      </section>
    </div>
  );
}
