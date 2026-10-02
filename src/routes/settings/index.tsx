import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/features/settings/ui/settings-nav";

export const Route = createFileRoute("/_authed/settings/")({
  // Rendered in the request's language; after an in-app switch the tab title catches up on the next navigation.
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("settings:title")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("settings:description") },
    ],
  }),
  component: SettingsPage,
});

/** /settings: links to Profile and Security. */
function SettingsPage() {
  const { t } = useTranslation("settings");
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title={t("title")} />
      <SettingsNav className="mt-6 max-w-md" />
    </div>
  );
}
