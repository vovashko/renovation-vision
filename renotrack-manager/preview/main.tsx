// Static preview entry: runs the portal client-only on demo data, for hosting as a plain
// set of files (no server). The real app entry is src/start.ts / src/server.ts.
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import "@/styles.css";

// The root route's shellComponent renders <html>/<body> for SSR; the preview mounts into a div.
routeTree.options.shellComponent = ({ children }: { children: ReactNode }) => <>{children}</>;

const router = createRouter({
  routeTree,
  context: { queryClient: new QueryClient() },
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
