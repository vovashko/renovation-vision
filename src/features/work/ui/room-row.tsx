import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { statusLabel, type Status } from "@/lib/status";
import { roomIcon } from "./room-icon";

// Item's own focus ring uses `outline-*` (with a base `outline-none`, overridden only on
// `:focus-visible`), so a persistent selection mark on the row needs a different CSS property.
// A ring (box-shadow) in the room's own status color keeps the "never primary" rule from
// status-ui.ts without fighting Item's outline.
const ringClass: Record<Status, string> = {
  done: "ring-status-done",
  progress: "ring-status-progress",
  pending: "ring-outline",
  blocked: "ring-status-blocked",
};

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
    <Item asChild className={cn(muted && "opacity-70")}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={!!active}
        className={cn(active && "ring-2 ring-inset", active && ringClass[status])}
      >
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
