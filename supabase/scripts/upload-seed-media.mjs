// Uploads the seed images to Storage at the paths referenced by supabase/seed.sql.
// The service role key bypasses Storage RLS, so this works against a freshly
// reset database before any auth session exists.
//
//   node supabase/scripts/upload-seed-media.mjs
//
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment when set
// (used by the hosted-demo reseed workflow), otherwise shells out to
// `supabase status -o env` for the local stack's values.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function localStatusEnv() {
  let out;
  try {
    out = execFileSync("supabase", ["status", "-o", "env"], { cwd: root, encoding: "utf8" });
  } catch (err) {
    console.error("Could not read `supabase status -o env` — is the local stack running (`supabase start`)?");
    console.error(err.message);
    process.exit(1);
  }
  const env = {};
  for (const line of out.split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

let url = process.env.SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  const env = localStatusEnv();
  url ??= env.API_URL;
  key ??= env.SERVICE_ROLE_KEY;
}
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see `supabase status -o env`).");
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
let failed = false;
for (const [path, asset] of Object.entries(files)) {
  const body = await readFile(resolve(root, "supabase/seed-media", asset));
  const { error } = await supabase.storage
    .from("project-media")
    .upload(`${PROJECT}/${path}`, body, { contentType: "image/jpeg", upsert: true });
  if (error) failed = true;
  console.log(error ? `✗ ${path}: ${error.message}` : `✓ ${path}`);
}
if (failed) process.exit(1);
