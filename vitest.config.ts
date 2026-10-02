import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A plain vitest config, deliberately not the app's vite.config.ts — that one
// pulls in the TanStack Start and Cloudflare plugins, which unit tests don't need.
export default defineConfig({
  // Mirrors vite.config.ts's define: so modules referencing the Sentry release global (see
  // src/lib/sentry-config.ts) don't throw a ReferenceError under vitest, which uses this config
  // instead of vite.config.ts (see the comment above).
  define: {
    __APP_RELEASE__: JSON.stringify(process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? "dev"),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The Workers runtime module only exists inside workerd; unit tests get a mutable stub.
      "cloudflare:workers": fileURLToPath(new URL("./tests/stubs/cloudflare-workers.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
