// Builds preview/ into preview/dist as static files (demo data, in-memory routing).
//   npx vite build --config preview/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "../src") } },
  // Force demo mode even if a .env with Supabase keys exists.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": "undefined",
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": "undefined",
    "import.meta.env.VITE_SUPABASE_ANON_KEY": "undefined",
  },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
});
