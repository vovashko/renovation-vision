import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { statusLabel, type Status } from "@/lib/status";
import { roomIcon } from "./room-icon";

/**
 * One row of the "Rooms" list (the spec's "Room list" panel): an icon tile, the name and status,
 * and a trailing chevron, or a check circle once the room is done.
 */
export function RoomRow({
  name,
  status,
  progress,
  active,
  muted,
  onClick,
  children,
}: {
  name: string;
  status: Status;
  progress: number;
  active?: boolean;
  muted?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <Item asChild selected={active} tone={status} className={cn(muted && "opacity-70")}>
      <button type="button" onClick={onClick} aria-pressed={!!active}>
        <ItemMedia variant="icon" tone={status} icon={roomIcon(name)} />
        <ItemContent>
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription>
            {statusLabel[status]} · {progress}%
          </ItemDescription>
          {children}
        </ItemContent>
        <ItemActions>
          {status === "done" ? (
            <span aria-hidden className="grid size-5 place-items-center rounded-full bg-success text-white">
              <Icon name="check" size={16} />
            </span>
          ) : (
            <Icon name="chevron_right" size={20} />
          )}
        </ItemActions>
      </button>
    </Item>
  );
}
