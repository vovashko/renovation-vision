import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";

/** Link from the plan's selected-room panel to the room view (works, materials, warnings). */
export function OpenRoomLink({ projectId, roomId }: { projectId: string; roomId: string }) {
  const { t } = useTranslation("work");
  return (
    <Link
      to="/projects/$projectId/rooms/$roomId"
      params={{ projectId, roomId }}
      className="mt-5 inline-flex items-center gap-1 py-2 text-label-lg text-primary"
    >
      {t("selectedRoom.openRoom")} <Icon name="arrow_forward" size={18} />
    </Link>
  );
}
