import { createFileRoute } from "@tanstack/react-router";
import { useNavRole } from "@/shared/ui/nav-role";
import { RoomView } from "@/features/work/ui/room-view";

export const Route = createFileRoute("/_authed/projects/$projectId/rooms/$roomId")({
  head: () => ({
    meta: [
      { title: "Room — RenoVision" },
      { name: "description", content: "A room's works, materials with delivery status and warnings for the investor." },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { projectId, roomId } = Route.useParams();
  const isManager = useNavRole() === "manager";
  return <RoomView projectId={projectId} roomId={roomId} isManager={isManager} />;
}
