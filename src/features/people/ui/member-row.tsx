import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ChatAvatar } from "@/components/chat";
import { dateTime } from "@/lib/format";
import type { Member } from "@/lib/database.types";

/** One row of the Team member list: avatar, name, last-read status, role, and a remove action. */
export function MemberItem({ member, isSelf, onRemove }: { member: Member; isSelf: boolean; onRemove: () => void }) {
  return (
    <Item variant="plain">
      <ItemMedia>
        <ChatAvatar name={member.profile.full_name || "?"} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="truncate">
          {member.profile.full_name}
          {isSelf && <span className="text-on-surface-variant"> (you)</span>}
        </ItemTitle>
        <ItemDescription>
          {member.last_read_at ? `Last read chat ${dateTime(member.last_read_at)}` : "Hasn't opened the chat yet"}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={member.role === "manager" ? "secondary" : "outline"}>{member.role === "manager" ? "Manager" : "Client"}</Badge>
        {!isSelf && (
          <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Remove ${member.profile.full_name}`} onClick={onRemove}>
            <Icon name="close" size={20} />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
