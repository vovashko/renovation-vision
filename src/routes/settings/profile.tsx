import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { AvatarForm } from "@/features/settings/ui/avatar-form";
import { LanguageForm } from "@/features/settings/ui/language-form";
import { ProfileForm } from "@/features/settings/ui/profile-form";
import { SettingsBackLink } from "@/features/settings/ui/settings-nav";

export const Route = createFileRoute("/_authed/settings/profile")({
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("settings:profile.title")} — RenoVision` }] }),
  component: ProfilePage,
});

/** /settings/profile: name, photo and language. */
function ProfilePage() {
  const { t } = useTranslation("settings");
  return (
    <div className="mx-auto w-full max-w-7xl">
      <SettingsBackLink />
      <PageHeader title={t("profile.title")} />
      <div className="mt-6 flex max-w-md flex-col gap-4">
        <ProfileForm />
        <AvatarForm />
        <LanguageForm />
      </div>
    </div>
  );
}
