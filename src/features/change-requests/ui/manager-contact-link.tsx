import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useVisibleContacts } from "@/features/people/hooks";
import { managerContactHref } from "../domain/contact";

/** "Questions? Message your manager": questions about a request go to WhatsApp (decision 2). Hidden without a number. */
export function ManagerContactLink({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["change-requests"]);
  const { data: contacts = [] } = useVisibleContacts(projectId);
  const href = managerContactHref(contacts);
  if (!href) return null;
  const external = href.startsWith("https:");
  return (
    <Button asChild variant="link" className="gap-2">
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
        <Icon name="chat" size={20} /> {t("change-requests:actions.questions")}
      </a>
    </Button>
  );
}
