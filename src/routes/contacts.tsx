import { createFileRoute, redirect } from "@tanstack/react-router";
import { isStaff } from "@/domain/account";
import { ContactsPage } from "@/features/people/ui/contacts-page";

/**
 * The address book (T46): any staff account; clients and signed-out visitors go home. RLS on `contacts` is the real
 * gate (staff only), so this guard only saves the others an empty page.
 */
export const Route = createFileRoute("/_authed/contacts")({
  beforeLoad: ({ context }) => {
    if (!isStaff(context.auth.profile?.account_type)) throw redirect({ to: "/", replace: true });
  },
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("people:contacts.pageTitle")} — RenoVision` }] }),
  component: ContactsPage,
});
