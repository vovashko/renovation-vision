import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { InboxNotification, Notification } from "@/lib/database.types";
import { useInbox, useMarkNotificationsRead, useOpenNotification } from "@/features/comms/hooks/use-inbox";
import { InboxNotificationItem } from "./notification-item";

/** The user's notifications, newest first; opening one marks it read and goes where it leads. */
export function InboxList({
  notifications,
  onOpen,
  showProject = false,
}: {
  notifications: (Notification | InboxNotification)[];
  onOpen: (n: Notification) => void;
  showProject?: boolean;
}) {
  return (
    <ItemGroup>
      {notifications.map((n) => (
        <InboxNotificationItem
          key={n.id}
          notification={n}
          projectName={showProject && "project" in n ? n.project?.name : undefined}
          onOpen={() => onOpen(n)}
        />
      ))}
    </ItemGroup>
  );
}

export function InboxEmpty() {
  const { t } = useTranslation("comms");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon="notifications" />
        <EmptyTitle>{t("inbox.empty")}</EmptyTitle>
        <EmptyDescription>{t("inbox.emptyText")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * The bell's inbox: a bottom sheet on phones, a side panel from md up. Lists the user's notifications across their
 * projects (loaded when opened, kept live by `useInboxRealtime`), with "Mark all read" and a link to the email
 * settings.
 */
export function InboxSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation("comms");
  const { data: notifications, isLoading } = useInbox(open);
  const markRead = useMarkNotificationsRead();
  const openNotification = useOpenNotification();
  const hasUnread = (notifications ?? []).some((n) => !n.read_at);
  const several = new Set((notifications ?? []).map((n) => n.project_id)).size > 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive" className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-5 md:max-h-none">
        <SheetHeader>
          <SheetTitle>{t("inbox.title")}</SheetTitle>
          <SheetDescription>{t("inbox.description")}</SheetDescription>
        </SheetHeader>
        {isLoading || !notifications ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : notifications.length === 0 ? (
          <InboxEmpty />
        ) : (
          <InboxList
            notifications={notifications}
            showProject={several}
            onOpen={(n) => {
              onOpenChange(false);
              openNotification(n);
            }}
          />
        )}
        <SheetFooter className="mt-auto gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings/notifications" onClick={() => onOpenChange(false)}>
              {t("inbox.emailSettings")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" disabled={!hasUnread} loading={markRead.isPending} onClick={() => markRead.mutate(null)}>
            {t("inbox.markAllRead")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
