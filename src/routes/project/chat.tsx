import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The in-app chat is gone (T66): conversations happen on WhatsApp, linked from the contact cards.
 * This route stays only to keep old links, bookmarks and notifications working.
 */
export const Route = createFileRoute("/_authed/projects/$projectId/chat")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/projects/$projectId", params });
  },
});
