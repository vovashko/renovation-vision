// Static SPA build of the client portal into docs/, for GitHub Pages.
// Run with `npm run build:preview`; the app's own build (TanStack Start) is unchanged.
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(import.meta.dirname, "..");

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(root, "src") } },
  build: {
    outDir: path.join(root, "docs"),
    emptyOutDir: true,
  },
});
