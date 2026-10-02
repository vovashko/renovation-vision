import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Member, ProjectContact } from "@/lib/database.types";
import { telHref as tel } from "../domain/contacts";
const onPanelButton = buttonVariants({ variant: "panel" });

function ContactLine({ icon, href, children }: { icon: string; href?: string; children: ReactNode }) {
  const inner = (
    <>
      <Icon name={icon} size={20} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
  const row = "flex min-h-12 items-center gap-3 px-4 text-body-lg";
  return href ? (
    <a
      href={href}
      className={cn(
        row,
        "text-on-surface transition-colors duration-150 hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:bg-surface",
      )}
    >
      {inner}
    </a>
  ) : (
    <div className={cn(row, "text-on-surface-variant")}>{inner}</div>
  );
}

/** The manager overview's client card: the project's primary client contact, and quick actions. */
export function ClientCard({
  projectId,
  client,
  appUsers,
  onEdit,
}: {
  projectId: string;
  /** The primary client contact (`project_contacts` role client), if there is one. */
  client: ProjectContact | undefined;
  appUsers: Member[];
  onEdit: () => void;
}) {
  const { t } = useTranslation(["people"]);
  const name = client?.contact.full_name || appUsers.map((m) => m.profile.full_name).join(" & ") || t("client.fallbackName");
  const phone = client?.contact.phone;
  const email = client?.contact.email;
  return (
    <Card variant="tinted" className="flex flex-col gap-4 p-5 md:p-6" aria-labelledby="client-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="client-heading" className="text-title-lg">
          {t("client.heading")}
        </h2>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("client.editAria")} className="-mr-3">
          <Icon name="edit" size={22} />
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <UserAvatar name={name} className="size-12 text-title-md" />
        <div className="min-w-0">
          <div className="truncate text-title-md">{name}</div>
          <div className="truncate text-body-md text-on-surface-variant">
            {appUsers.length ? t("client.inApp", { names: appUsers.map((m) => m.profile.full_name).join(", ") }) : t("client.notInvited")}
          </div>
        </div>
      </div>
      {/* On the tinted panel: a white inner list and white buttons. */}
      <div className="divide-y divide-outline-variant overflow-hidden rounded-lg bg-surface-container-lowest">
        {phone ? (
          <ContactLine icon="call" href={tel(phone)}>
            {phone}
          </ContactLine>
        ) : (
          <ContactLine icon="call">{t("client.noPhone")}</ContactLine>
        )}
        {email ? (
          <ContactLine icon="mail" href={`mailto:${email}`}>
            {email}
          </ContactLine>
        ) : (
          <ContactLine icon="mail">{t("client.noEmail")}</ContactLine>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/projects/$projectId/chat" params={{ projectId }} className={cn(onPanelButton, "col-span-2")}>
          <Icon name="chat_bubble" size={20} />
          {t("client.message")}
        </Link>
        {phone && (
          <a href={tel(phone)} className={onPanelButton}>
            <Icon name="call" size={20} />
            {t("client.call")}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={onPanelButton}>
            <Icon name="mail" size={20} />
            {t("client.email")}
          </a>
        )}
      </div>
    </Card>
  );
}
