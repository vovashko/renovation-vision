import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { isStaff } from "@/domain/account";
import { StaffAccounts } from "@/features/admin/ui/staff-accounts";

/** The Staff page (T40): any staff account; others go home. The server function checks it again (requireStaff). */
export const Route = createFileRoute("/_authed/admin/staff")({
  beforeLoad: ({ context }) => {
    if (!isStaff(context.auth.profile?.account_type)) throw redirect({ to: "/", replace: true });
  },
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("admin:staff.pageTitle")} — RenoVision` }] }),
  component: StaffPage,
});

function StaffPage() {
  const { t } = useTranslation(["admin"]);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader title={t("staff.pageTitle")} description={t("staff.pageDescription")} />
      <StaffAccounts />
    </div>
  );
}
