import { createFileRoute, redirect } from "@tanstack/react-router";

/** The AI knowledge page was removed with the chat (T66). Kept only so old links land on the overview. */
export const Route = createFileRoute("/_authed/projects/$projectId/knowledge")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projects/$projectId", params });
  },
});
