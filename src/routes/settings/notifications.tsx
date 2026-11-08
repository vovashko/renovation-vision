import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader, PageLoading } from "@/components/page-header";
import { SettingsBackLink } from "@/features/settings/ui/settings-nav";
import { EmailPreferencesList } from "@/features/comms/ui/notification-preferences";
import { useEmailPreferences, useSaveEmailPreference } from "@/features/comms/hooks/use-notification-preferences";

export const Route = createFileRoute("/_authed/settings/notifications")({
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("settings:notifications.title")} — RenoVision` }] }),
  component: NotificationSettingsPage,
});

/** /settings/notifications: per group, always in the app, and an email frequency (right away, daily, off). */
function NotificationSettingsPage() {
  const { t } = useTranslation("comms");
  const { data: preferences, isLoading } = useEmailPreferences();
  const save = useSaveEmailPreference();
  return (
    <div className="mx-auto w-full max-w-7xl">
      <SettingsBackLink />
      <PageHeader title={t("preferences.title")} description={t("preferences.description")} />
      <div className="mt-6 max-w-2xl">
        {isLoading || !preferences ? (
          <PageLoading />
        ) : (
          <EmailPreferencesList
            preferences={preferences}
            disabled={save.isPending}
            onChange={(group, frequency) => save.mutate({ group, frequency })}
          />
        )}
      </div>
    </div>
  );
}
