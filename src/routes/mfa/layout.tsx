import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

type MfaSearch = { redirect?: string };

/**
 * /mfa and /mfa/enroll: signed-in only, but outside `_authed`, so an aal1 session (which `_authed`
 * may send here) can reach them, and they get no app shell.
 */
export const Route = createFileRoute("/mfa")({
  validateSearch: (search: Record<string, unknown>): MfaSearch =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: ({ context, location }) => {
    const user = context.auth.user;
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { user };
  },
  component: Outlet,
});
