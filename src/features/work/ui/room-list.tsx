import type { ReactNode } from "react";
import { ItemGroup } from "@/components/ui/item";
import { RoomRow } from "./room-row";
import type { Status } from "@/lib/status";

export type RoomListRoom = { id: string; name: string; status: Status; progress: number; muted?: boolean };

/** The plan page's "Rooms" list: one RoomRow per room. */
export function RoomList({
  rooms,
  activeId,
  onSelect,
  rowExtra,
}: {
  rooms: RoomListRoom[];
  activeId: string | null;
  onSelect: (room: RoomListRoom) => void;
  /** Extra content under a row's description, e.g. a "hidden from client" badge. */
  rowExtra?: (room: RoomListRoom) => ReactNode;
}) {
  return (
    <ItemGroup>
      {rooms.map((r) => (
        <RoomRow
          key={r.id}
          name={r.name}
          status={r.status}
          progress={r.progress}
          active={r.id === activeId}
          muted={r.muted}
          onClick={() => onSelect(r)}
        >
          {rowExtra?.(r)}
        </RoomRow>
      ))}
    </ItemGroup>
  );
}
