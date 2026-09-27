import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import type { CrewMember } from "@/lib/database.types";

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function ContactIcon({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a href={href} aria-label={label} className={buttonVariants({ variant: "outline", size: "icon" })}>
      <Icon name={icon} size={22} />
    </a>
  );
}

/** One row of the team card's site crew list: a trade/phone contact and an edit button. */
export function CrewRow({ crew, onEdit }: { crew: CrewMember; onEdit: (c: CrewMember) => void }) {
  const { t } = useTranslation(["people"]);
  return (
    <li className="flex min-h-16 items-center gap-3 py-3">
      <UserAvatar name={crew.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-lg">{crew.name}</div>
        <div className="truncate text-body-md text-on-surface-variant">
          {crew.trade}
          {/* Phones show the call button instead of the number. */}
          {crew.phone && (
            <span className="hidden sm:inline">
              {crew.trade ? " · " : ""}
              {crew.phone}
            </span>
          )}
          {!crew.trade && !crew.phone && t("crew.noContact")}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {crew.phone && <ContactIcon href={tel(crew.phone)} icon="call" label={t("crew.callAria", { name: crew.name })} />}
        {crew.email && <ContactIcon href={`mailto:${crew.email}`} icon="mail" label={t("crew.emailAria", { name: crew.name })} />}
        <Button variant="ghost" size="icon" onClick={() => onEdit(crew)} aria-label={t("crew.editAria", { name: crew.name })}>
          <Icon name="more_vert" size={22} />
        </Button>
      </div>
    </li>
  );
}
