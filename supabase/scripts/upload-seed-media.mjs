// Uploads the demo images to Storage at the paths referenced by supabase/seed.sql.
// The images are the Renovision client app's own assets (read-only), so both apps show the same pictures.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/scripts/upload-seed-media.mjs
//
// Requires @supabase/supabase-js (installed in renotrack-manager/).
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "renotrack-manager/package.json"));
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const PROJECT = "b0000000-0000-4000-8000-000000000001";
const files = {
  "photos/p1-living-drywall.jpg": "photo-drywall.jpg",
  "photos/p2-bed1-subfloor.jpg": "photo-flooring.jpg",
  "photos/p3-dining-drywall.jpg": "photo-drywall.jpg",
  "photos/p4-bed1-leveling.jpg": "photo-flooring.jpg",
  "photos/p5-bed2-wiring.jpg": "photo-wiring.jpg",
  "photos/p6-kitchen-panel.jpg": "photo-wiring.jpg",
  "photos/p7-living-demo.jpg": "photo-demo.jpg",
  "photos/p8-dining-demo.jpg": "photo-demo.jpg",
  "photos/p9-bed2-junction-draft.jpg": "photo-wiring.jpg",
  "renders/r1-living.jpg": "render-living.jpg",
  "renders/r2-kitchen.jpg": "render-kitchen.jpg",
  "renders/r3-bath.jpg": "render-bath.jpg",
  "renders/r4-bedroom.jpg": "render-bedroom.jpg",
};

const supabase = createClient(url, key, { auth: { persistSession: false } });
for (const [path, asset] of Object.entries(files)) {
  const body = await readFile(resolve(root, "src/assets", asset));
  const { error } = await supabase.storage
    .from("project-media")
    .upload(`${PROJECT}/${path}`, body, { contentType: "image/jpeg", upsert: true });
  console.log(error ? `✗ ${path}: ${error.message}` : `✓ ${path}`);
}
