import { index, layout, rootRoute, route } from "@tanstack/virtual-file-routes";

// URLs keep the project id (/projects/<id>/budget) while files stay flat (routes/project/budget.tsx).
// Paths are relative to src/routes. Every app page sits under the pathless `_authed` layout, whose
// beforeLoad sends signed-out visitors to /login (README → Sessions & route guards); only /login
// is public. Add new project pages under the $projectId route.
export const routes = rootRoute("__root.tsx", [
  route("/login", "login.tsx"),
  layout("_authed", "_authed.tsx", [
    index("index.tsx"),
    route("/settings", "settings.tsx"),
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
        route("updates", "project/updates.tsx"),
        route("knowledge", "project/knowledge.tsx"),
        route("team", "project/team.tsx"),
      ]),
    ]),
  ]),
]);
