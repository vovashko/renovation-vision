import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import type { ProjectContact } from "@/lib/database.types";
import { telHref } from "../domain/contacts";

function ContactIcon({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a href={href} aria-label={label} className={buttonVariants({ variant: "outline", size: "icon" })}>
      <Icon name={icon} size={22} />
    </a>
  );
}

/** One row of the team card's site crew list: a trade/phone contact and an edit button. */
export function CrewRow({ crew, onEdit }: { crew: ProjectContact; onEdit: (c: ProjectContact) => void }) {
  const { t } = useTranslation(["people"]);
  const { full_name: name, trade, phone, email } = crew.contact;
  return (
    <li className="flex min-h-16 items-center gap-3 py-3">
      <UserAvatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-lg">{name}</div>
        <div className="truncate text-body-md text-on-surface-variant">
          {trade}
          {/* Phones show the call button instead of the number. */}
          {phone && (
            <span className="hidden sm:inline">
              {trade ? " · " : ""}
              {phone}
            </span>
          )}
          {!trade && !phone && t("crew.noContact")}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {phone && <ContactIcon href={telHref(phone)} icon="call" label={t("crew.callAria", { name })} />}
        {email && <ContactIcon href={`mailto:${email}`} icon="mail" label={t("crew.emailAria", { name })} />}
        <Button variant="ghost" size="icon" onClick={() => onEdit(crew)} aria-label={t("crew.editAria", { name })}>
          <Icon name="more_vert" size={22} />
        </Button>
      </div>
    </li>
  );
}
