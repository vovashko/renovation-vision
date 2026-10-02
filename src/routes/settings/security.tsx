import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { AccountCard } from "@/features/settings/ui/account-card";
import { ChangePasswordCard } from "@/features/settings/ui/change-password-card";
import { SettingsBackLink } from "@/features/settings/ui/settings-nav";
import { TwoFactorCard } from "@/features/settings/ui/two-factor-card";

export const Route = createFileRoute("/_authed/settings/security")({
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("settings:security.title")} — RenoVision` }] }),
  component: SecurityPage,
});

/** /settings/security: 2FA, the password, and the session as the server sees it. */
function SecurityPage() {
  const { t } = useTranslation("settings");
  return (
    <div className="mx-auto w-full max-w-7xl">
      <SettingsBackLink />
      <PageHeader title={t("security.title")} />
      <div className="mt-6 flex max-w-md flex-col gap-4">
        <TwoFactorCard />
        <ChangePasswordCard />
        <AccountCard />
      </div>
    </div>
  );
}
