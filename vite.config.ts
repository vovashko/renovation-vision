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
  define: {
    // Sentry `release` (src/lib/sentry-config.ts): the commit this build was made from, so an
    // issue links straight back to a commit instead of just an environment. CI sets GITHUB_SHA;
    // a Cloudflare Pages/Workers Build sets CF_PAGES_COMMIT_SHA; neither is set for a local
    // `bun run dev`/`build`, hence the "dev" fallback. Inlined at build time into both the client
    // and the Worker bundle (mirrored in vitest.config.ts so tests see the same global).
    __APP_RELEASE__: JSON.stringify(process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? "dev"),
  },
  build: {
    // Source maps for Sentry stack traces (uploaded in CI: .github/workflows/ci.yml), without a
    // `//# sourceMappingURL` comment pointing at them — the browser never fetches them, and
    // `bun run deploy`/`deploy:preview` delete the .map files after the build, before `wrangler
    // deploy` uploads dist/client as static assets, so they're never served publicly either way.
    sourcemap: "hidden",
  },
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
