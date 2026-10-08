import { index, layout, rootRoute, route } from "@tanstack/virtual-file-routes";

// URLs keep the project id (/projects/<id>/budget) while files stay flat (routes/project/budget.tsx).
// Paths are relative to src/routes. Every app page sits under the pathless `_authed` layout, whose
// beforeLoad sends signed-out visitors to /login and aal1 staff to 2FA while it's enforced (README →
// Sessions & route guards). /login, /forgot-password and /reset-password are public; /mfa needs a
// session but sits outside `_authed` (and its 2FA guard and app shell). Add new project pages under
// the $projectId route.
export const routes = rootRoute("__root.tsx", [
  route("/login", "login.tsx"),
  route("/forgot-password", "forgot-password.tsx"),
  route("/reset-password", "reset-password.tsx"),
  route("/mfa", "mfa/layout.tsx", [index("mfa/challenge.tsx"), route("enroll", "mfa/enroll.tsx")]),
  layout("_authed", "_authed.tsx", [
    index("index.tsx"),
    route("/settings", [index("settings/index.tsx"), route("profile", "settings/profile.tsx"), route("security", "settings/security.tsx")]),
    route("/projects", [
      index("projects.tsx"),
      route("$projectId", "project/layout.tsx", [
        index("project/overview.tsx"),
        route("progress", "project/progress.tsx"),
        // Kept as redirects to progress?view=timeline / progress?view=plan so old links still work.
        route("stages", "project/stages.tsx"),
        route("plan", "project/plan.tsx"),
        route("photos", "project/photos.tsx"),
        route("design", "project/design.tsx"),
        route("budget", "project/budget.tsx"),
        route("chat", "project/chat.tsx"),
        route("decisions", "project/decisions.tsx"),
        route("updates", "project/updates.tsx"),
        route("knowledge", "project/knowledge.tsx"),
        route("team", "project/team.tsx"),
      ]),
    ]),
  ]),
]);
