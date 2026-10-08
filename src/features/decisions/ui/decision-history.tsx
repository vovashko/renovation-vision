import { useTranslation } from "react-i18next";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import type { DecisionEvent } from "@/lib/database.types";
import { eventHasText } from "../domain/status";

/**
 * The case's append-only history: who did what and when, oldest first. `nameOf` resolves an actor id to a
 * name (null when the account is gone). The question, answer and rejection reason are shown as written.
 */
export function DecisionHistory({ events, nameOf }: { events: DecisionEvent[]; nameOf: (actorId: string | null) => string | null }) {
  const { t } = useTranslation(["decisions"]);
  const format = useFormat();
  if (events.length === 0) return <p className="text-body-md text-on-surface-variant">{t("decisions:history.empty")}</p>;
  return (
    <ItemGroup>
      {events.map((event) => {
        const name = nameOf(event.actor_id) ?? (event.actor_id ? t("decisions:history.former") : t("decisions:history.system"));
        const role = event.actor_role ? ` (${t(`decisions:history.role.${event.actor_role}`)})` : "";
        return (
          <Item key={event.id}>
            <ItemContent>
              <ItemTitle>
                {name}
                {role} · {t(`decisions:history.kind.${event.kind}`)}
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
