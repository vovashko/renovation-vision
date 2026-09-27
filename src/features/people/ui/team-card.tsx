import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import type { CrewMember, Member } from "@/lib/database.types";
import { CrewRow } from "./crew-row";

/** The manager overview's team card: managers in the app, plus the site crew. */
export function TeamCard({
  managers,
  crew,
  onAdd,
  onEdit,
}: {
  managers: Member[];
  crew: CrewMember[];
  onAdd: () => void;
  onEdit: (c: CrewMember) => void;
}) {
  const { t } = useTranslation(["people"]);
  return (
    <Card className="p-5 md:p-6" aria-labelledby="team-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="team-heading" className="text-title-lg">
          {t("team.heading")}
        </h2>
        <Button variant="ghost" onClick={onAdd} className="-mr-3">
          <Icon name="person_add" size={20} />
          {t("team.addPerson")}
        </Button>
      </div>
      <ul className="mt-2 divide-y divide-outline-variant">
        {managers.map((m) => (
          <li key={m.user_id} className="flex min-h-16 items-center gap-3 py-3">
            <UserAvatar name={m.profile.full_name} src={m.profile.avatar_url} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-lg">{m.profile.full_name}</div>
              <div className="text-body-md text-on-surface-variant">{t("team.projectManager")}</div>
            </div>
            <Badge variant="default" size="compact" icon="verified_user">
              {t("team.managerBadge")}
            </Badge>
          </li>
        ))}
        {crew.map((c) => (
          <CrewRow key={c.id} crew={c} onEdit={onEdit} />
        ))}
      </ul>
      {crew.length === 0 && <p className="mt-2 text-body-md text-on-surface-variant">{t("team.addCrewHint")}</p>}
    </Card>
  );
}
