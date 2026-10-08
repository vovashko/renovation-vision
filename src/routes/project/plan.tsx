import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The floor plan lives in the Projekt page's plan view (`/design?view=plan`). This route stays only
 * to keep old links working, including the `room` search param (e.g. from the manager overview's
 * "blocked" issues list).
 */
export const Route = createFileRoute("/_authed/projects/$projectId/plan")({
  validateSearch: (s: Record<string, unknown>): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/projects/$projectId/design", params, search: { view: "plan", room: search.room } });
  },
});
