import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ChatAvatar } from "@/components/ui/avatar-initials";
import { useFormat } from "@/i18n";
import type { Member } from "@/lib/database.types";

/** One row of the Team member list: avatar, name, last-read status, role, and a remove action. */
export function MemberItem({ member, isSelf, onRemove }: { member: Member; isSelf: boolean; onRemove: () => void }) {
  const { t } = useTranslation(["people"]);
  const format = useFormat();
  return (
    <Item variant="plain">
      <ItemMedia>
        <ChatAvatar name={member.profile.full_name || "?"} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="truncate">
          {member.profile.full_name}
          {isSelf && <span className="text-on-surface-variant"> {t("team.you")}</span>}
        </ItemTitle>
        <ItemDescription>
          {member.last_read_at ? t("team.lastRead", { when: format.date(member.last_read_at, "dayTime") }) : t("team.neverRead")}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={member.role === "manager" ? "secondary" : "outline"}>
          {member.role === "manager" ? t("team.managerBadge") : t("team.clientBadge")}
        </Badge>
        {!isSelf && (
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            aria-label={t("team.removeAria", { name: member.profile.full_name })}
            onClick={onRemove}
          >
            <Icon name="close" size={20} />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
