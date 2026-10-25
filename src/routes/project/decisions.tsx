import { createFileRoute, redirect } from "@tanstack/react-router";

// The bug-bash "Decisions" page became change requests in Budget (T61). Old links (`?case=<id>`) still work.
export const Route = createFileRoute("/_authed/projects/$projectId/decisions")({
  beforeLoad: ({ params, search }) => {
    const id = (search as Record<string, unknown>).case;
    throw redirect({
      to: "/projects/$projectId/budget",
      params,
      search: { request: typeof id === "string" ? id : undefined },
      replace: true,
    });
  },
});
