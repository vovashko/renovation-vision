import type { ReactNode } from "react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { PresenceDot } from "@/components/ui/presence-dot";
import { initials } from "@/components/chat";

/** The other side of the conversation: name, presence and role, above the message list. */
export function ChatHeader({
  name,
  roleLabel,
  online,
  actions,
}: {
  name: string;
  roleLabel: string;
  online: boolean;
  actions?: ReactNode;
}) {
  return (
    <Item variant="plain" size="lg" className="gap-3 px-4 py-3">
      <ItemMedia>
        <AvatarInitials initials={initials(name)} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="truncate">{name}</ItemTitle>
        <ItemDescription className="line-clamp-none flex items-center gap-1.5">
          <PresenceDot online={online} />
          {online ? "Online" : "Offline"} · {roleLabel}
        </ItemDescription>
      </ItemContent>
      {actions && <ItemActions>{actions}</ItemActions>}
    </Item>
  );
}
