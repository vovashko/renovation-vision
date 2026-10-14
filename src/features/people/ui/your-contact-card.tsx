import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { UserAvatar } from "@/components/user-avatar";
import type { ProjectContactRole, VisibleContact } from "@/lib/database.types";
import { contactLinks } from "../domain/contact-links";
import { useVisibleContacts } from "../hooks";

function ContactItem({ contact, roleLabel }: { contact: VisibleContact; roleLabel: string }) {
  const { t } = useTranslation(["people"]);
  const name = contact.full_name;
  // Clients only get a phone and an email for a contact, so WhatsApp uses the phone.
  const links = contactLinks({ phone: contact.phone, email: contact.email });
  return (
    <Item variant="plain">
      <ItemMedia>
        <UserAvatar name={name} className="size-12 text-title-md" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="truncate">{name}</ItemTitle>
        <ItemDescription>{roleLabel}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {links.whatsapp && (
          <Button asChild variant="outline" size="icon" aria-label={t("yourContact.whatsappAria", { name })}>
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={22} />
            </a>
          </Button>
        )}
        {links.tel && (
          <Button asChild variant="outline" size="icon" aria-label={t("yourContact.callAria", { name })}>
            <a href={links.tel}>
              <Icon name="call" size={22} />
            </a>
          </Button>
        )}
        {links.mailto && (
          <Button asChild variant="outline" size="icon" aria-label={t("yourContact.emailAria", { name })}>
            <a href={links.mailto}>
              <Icon name="mail" size={22} />
            </a>
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

/**
 * The client overview's "Your contact" card: the project's point of contact (and any other contact the
 * manager made visible to the client), from `project_visible_contacts`, each with WhatsApp, Call and
 * Email buttons for the details they have. Renders nothing when there is no contact.
 */
export function YourContactCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["people"]);
  const { data: contacts = [] } = useVisibleContacts(projectId);
  if (contacts.length === 0) return null;
  const roleLabel = (role: ProjectContactRole) => t(`yourContact.role.${role}`);

  return (
    <Card className="flex flex-col gap-2 p-5 md:p-6" aria-labelledby="your-contact-heading">
      <h2 id="your-contact-heading" className="text-title-lg">
        {t("yourContact.heading", { count: contacts.length })}
      </h2>
      <ul className="divide-y divide-outline-variant">
        {contacts.map((c) => (
          <li key={`${c.role}-${c.full_name}`}>
            <ContactItem contact={c} roleLabel={roleLabel(c.role)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
