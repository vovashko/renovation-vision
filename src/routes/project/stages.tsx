import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The stages page moved into Progress's timeline view (T13: "work" feature layer split). This
 * route stays only to keep old links — bookmarks, notifications, the manager overview — working,
 * including a stage anchor hash (`#<stageId>`).
 */
export const Route = createFileRoute("/_authed/projects/$projectId/stages")({
  beforeLoad: ({ params, location }) => {
    throw redirect({ to: "/projects/$projectId/progress", params, search: { view: "timeline" }, hash: location.hash || undefined });
  },
});
