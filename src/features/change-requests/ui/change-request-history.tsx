import { useTranslation } from "react-i18next";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import type { ChangeRequestEvent } from "@/lib/database.types";
import { eventHasText } from "../domain/status";

/**
 * The request's append-only history: who did what and when, oldest first. `nameOf` resolves an actor id to a
 * name (null when the account is gone). A rejection reason (or an old question or answer) is shown as written.
 */
export function ChangeRequestHistory({
  events,
  nameOf,
}: {
  events: ChangeRequestEvent[];
  nameOf: (actorId: string | null) => string | null;
}) {
  const { t } = useTranslation(["change-requests"]);
  const format = useFormat();
  if (events.length === 0) return <p className="text-body-md text-on-surface-variant">{t("change-requests:history.empty")}</p>;
  return (
    <ItemGroup>
      {events.map((event) => {
        const name = nameOf(event.actor_id) ?? (event.actor_id ? t("change-requests:history.former") : t("change-requests:history.system"));
        const role = event.actor_role ? ` (${t(`change-requests:history.role.${event.actor_role}`)})` : "";
        return (
          <Item key={event.id}>
            <ItemContent>
              <ItemTitle>
                {name}
                {role} · {t(`change-requests:history.kind.${event.kind}`)}
              </ItemTitle>
              {eventHasText(event) && <ItemDescription className="line-clamp-none whitespace-pre-wrap">{event.text}</ItemDescription>}
            </ItemContent>
            <ItemActions>
              <span className="shrink-0 text-body-sm text-on-surface-variant">{format.date(event.created_at, "dayTime")}</span>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
