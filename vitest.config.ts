import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A plain vitest config, deliberately not the app's vite.config.ts — that one
// pulls in the TanStack Start and Cloudflare plugins, which unit tests don't need.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
