import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The floor plan moved into Progress's plan view (T13: "work" feature layer split). This route
 * stays only to keep old links working, including the `room` search param (e.g. from the manager
 * overview's "blocked" issues list).
 */
export const Route = createFileRoute("/_authed/projects/$projectId/plan")({
  validateSearch: (s: Record<string, unknown>): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/projects/$projectId/progress", params, search: { view: "plan", room: search.room } });
  },
});
