import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { UserAvatar } from "@/components/user-avatar";
import type { Contact } from "@/lib/database.types";
import { contactLinks } from "../domain/contact-links";

/** WhatsApp, Call and Email buttons for the details a contact has (a missing detail has no button). */
export function ContactButtons({ contact }: { contact: Contact }) {
  const { t } = useTranslation(["people"]);
  const links = contactLinks(contact);
  const name = contact.full_name;
  return (
    <>
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
    </>
  );
}

/** One address-book row: avatar, name, trade and company, the kind, the contact buttons and an edit button. */
export function ContactRow({ contact, onEdit }: { contact: Contact; onEdit: (c: Contact) => void }) {
  const { t } = useTranslation(["people"]);
  const detail = [contact.trade, contact.company].filter(Boolean).join(" · ");
  return (
    <Item variant="plain">
      <ItemMedia>
        <UserAvatar name={contact.full_name} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="truncate">{contact.full_name}</ItemTitle>
        {detail && <ItemDescription className="truncate">{detail}</ItemDescription>}
      </ItemContent>
      <ItemActions>
        <Badge variant="outline" size="compact" className="hidden sm:inline-flex">
          {t(`contacts.kind.${contact.kind}`)}
        </Badge>
        <ContactButtons contact={contact} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(contact)}
          aria-label={t("contacts.editAria", { name: contact.full_name })}
        >
          <Icon name="more_vert" size={22} />
        </Button>
      </ItemActions>
    </Item>
  );
}

/** The filtered contacts as a divided list. */
export function ContactRows({ contacts, onEdit }: { contacts: Contact[]; onEdit: (c: Contact) => void }) {
  return (
    <ItemGroup>
      {contacts.map((c) => (
        <div role="listitem" key={c.id}>
          <ContactRow contact={c} onEdit={onEdit} />
        </div>
      ))}
    </ItemGroup>
  );
}
