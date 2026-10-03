import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { UserAvatar } from "@/components/user-avatar";
import type { ProjectContactRole, VisibleContact } from "@/lib/database.types";
import { telHref } from "../domain/contacts";
import { useVisibleContacts } from "../hooks";

const iconButton = buttonVariants({ variant: "outline", size: "icon" });

function ContactItem({ contact, roleLabel }: { contact: VisibleContact; roleLabel: string }) {
  const { t } = useTranslation(["people"]);
  const name = contact.full_name;
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
        {contact.phone && (
          <a href={telHref(contact.phone)} aria-label={t("yourContact.callAria", { name })} className={iconButton}>
            <Icon name="call" size={22} />
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} aria-label={t("yourContact.emailAria", { name })} className={iconButton}>
            <Icon name="mail" size={22} />
          </a>
        )}
      </ItemActions>
    </Item>
  );
}

/**
 * The client overview's "Your contact" card: the project's point of contact (and any other contact the
 * manager made visible to the client), from `project_visible_contacts`. Renders nothing when there is none.
 */
export function YourContactCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["people"]);
  const { data: contacts = [] } = useVisibleContacts(projectId);
  if (contacts.length === 0) return null;
  const roleLabel = (role: ProjectContactRole) => t(`yourContact.role.${role}`);

  return (
    <Card className="flex flex-col gap-2 p-5 md:p-6" aria-labelledby="your-contact-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="your-contact-heading" className="text-title-lg">
          {t("yourContact.heading", { count: contacts.length })}
        </h2>
        <Link to="/projects/$projectId/chat" params={{ projectId }} className={buttonVariants({ variant: "ghost" })}>
          <Icon name="chat_bubble" size={20} />
          {t("yourContact.message")}
        </Link>
      </div>
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
