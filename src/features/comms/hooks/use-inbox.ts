import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useAuth } from "@/lib/auth";
import { commsRepo } from "@/features/comms/data/comms.repo";
import { notificationPath } from "@/features/comms/domain/delivery";
import type { InboxNotification } from "@/lib/database.types";

/** The signed-in user's notifications across their projects, newest first (the bell's inbox). */
export function useInbox(enabled = true) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: keys.inbox(userId ?? ""),
    queryFn: () => commsRepo.listInbox(userId!),
    enabled: !!userId && enabled,
  });
}

export function useUnreadCount() {
  const { userId } = useAuth();
  return useQuery({ queryKey: keys.inboxUnread(userId ?? ""), queryFn: () => commsRepo.unreadCount(userId!), enabled: !!userId });
}

/**
 * Keeps the inbox and its count live: refetches them whenever one of the user's notifications changes (Supabase
 * Realtime on `notifications`, RLS-filtered). Mount it once, in the app shell.
 */
export function useInboxRealtime() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    return commsRepo.subscribeToInbox(userId, () => void qc.invalidateQueries({ queryKey: keys.inbox(userId) }));
  }, [userId, qc]);
}

/** Opening a notification: marks it read (if it isn't) and goes where it leads (its project section, its request). */
export function useOpenNotification() {
  const router = useRouter();
  const { mutate: markRead } = useMarkNotificationsRead();
  return useCallback(
    (n: Pick<InboxNotification, "id" | "read_at" | "project_id" | "link" | "entity_type" | "entity_id">) => {
      if (!n.read_at) markRead([n.id]);
      void router.navigate({ href: notificationPath(n) });
    },
    [router, markRead],
  );
}

/**
 * Marks notifications read (`ids`) or all of them (null). The bell's count and the rows update at once
 * (optimistically); the inbox and the Updates page refetch afterwards.
 */
export function useMarkNotificationsRead() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation(["common"]);
  return useMutation<void, Error, string[] | null>({
    mutationFn: (ids) => commsRepo.markRead(ids),
    onMutate: (ids) => {
      if (!userId) return;
      const now = new Date().toISOString();
      const inbox = qc.getQueryData<InboxNotification[]>(keys.inbox(userId));
      if (inbox) {
        const marked = inbox.filter((n) => !n.read_at && (!ids || ids.includes(n.id))).length;
        qc.setQueryData<InboxNotification[]>(
          keys.inbox(userId),
          inbox.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n)),
        );
        qc.setQueryData<number>(keys.inboxUnread(userId), (count) => (ids ? Math.max((count ?? 0) - marked, 0) : 0));
      } else if (!ids) {
        qc.setQueryData<number>(keys.inboxUnread(userId), 0);
      }
    },
    onError: () => void toast.error(t("common:errors.generic")),
    onSettled: () => {
      if (userId) void qc.invalidateQueries({ queryKey: keys.inbox(userId) });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
