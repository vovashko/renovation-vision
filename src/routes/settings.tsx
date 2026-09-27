import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { LanguageForm } from "@/features/settings/ui/language-form";

export const Route = createFileRoute("/settings")({
  // Rendered in the request's language; after an in-app switch the tab title catches up on the next navigation.
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("settings:title")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("settings:description") },
    ],
  }),
  component: SettingsPage,
});

// Your profile is edited from the avatar pinned at the bottom of the nav rail.
function SettingsPage() {
  const { t } = useTranslation("settings");
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title={t("title")} />
      <LanguageForm className="mt-6 max-w-md" />
    </div>
  );
}
