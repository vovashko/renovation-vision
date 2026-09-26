import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds the Worker from wrangler.jsonc's `main` (src/server.ts),
// which in turn imports the real handler from `server.entry` below.
export default defineConfig({
  plugins: [
    // Must come first: wires up the "ssr" Vite environment as the Worker build/dev target.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      // Flat route files mapped to URLs in src/routes.config.ts.
      router: { virtualRouteConfig: "./src/routes.config.ts" },
    }),
    viteReact(),
  ],
  resolve: {
    // Avoid duplicate React/TanStack Query instances across the client and ssr environments.
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
