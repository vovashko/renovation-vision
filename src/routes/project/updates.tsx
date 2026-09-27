import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { ActivityLog } from "@/features/comms/ui/activity-log";
import { AnnouncementForm, type AnnouncementLink } from "@/features/comms/ui/announcement-form";
import { InboxNotificationItem, SentNotificationItem } from "@/features/comms/ui/notification-item";
import { useAuth } from "@/lib/auth";
import { useMembers } from "@/lib/queries";
import { useActivity } from "@/features/comms/hooks/use-activity";
import { useNotifications, useNotifyClients } from "@/features/comms/hooks/use-notifications";
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

function UpdatesPage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation(["comms", "common"]);
  const { userId } = useAuth();
  const { data: notifications, isLoading } = useNotifications(projectId);
  const { data: activity = [] } = useActivity(projectId);
  const { data: members = [] } = useMembers(projectId);
  const send = useNotifyClients(projectId, { success: t("updates.announcement.sentToast") });

  const links: AnnouncementLink[] = [
    { value: "", label: t("updates.announcement.noLink") },
    { value: "/", label: t("common:nav.overview") },
    { value: "/stages", label: t("common:nav.stages") },
    { value: "/plan", label: t("common:nav.plan") },
    { value: "/photos", label: t("common:nav.photos") },
    { value: "/design", label: t("common:nav.design") },
    { value: "/chat", label: t("common:nav.chat") },
  ];

  if (isLoading || !notifications) return <PageLoading />;
  const clientIds = new Set(members.filter((m) => m.role === "client").map((m) => m.user_id));
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.profile.full_name ?? t("updates.inbox.systemSender");

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
      <PageHeader title={t("updates.title")} description={t("updates.description")} />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <AnnouncementForm
          pending={send.isPending}
          clientCount={clientIds.size}
          links={links}
          onSubmit={(values) => send.mutate({ title: values.title, body: values.body, link: values.link })}
        />

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-title-lg">
            <Icon name="notifications" size={22} /> {t("updates.sent.heading")}
          </h2>
          {sent.size === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" icon="notifications" />
                <EmptyDescription>{t("updates.sent.empty")}</EmptyDescription>
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
              <h2 className="mt-8 mb-3 text-title-lg">{t("updates.inbox.heading")}</h2>
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
          <Icon name="history" size={22} /> {t("updates.activity.heading")} <InternalBadge />
        </h2>
        {activity.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" icon="history" />
              <EmptyDescription>{t("updates.activity.empty")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ActivityLog activity={activity} nameOf={nameOf} />
        )}
      </section>
    </div>
  );
}
