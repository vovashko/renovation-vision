#!/usr/bin/env bun
// One-off companion to supabase/migrations/20261025000300_documents_v2.sql (T62). The migration turned every
// installation-photo document into a row in `photos` whose storage_path is '<project>/photos/<file>' and deleted
// the archived documents; this script moves the OBJECTS to match:
//
//   * '<project>/installation_photos/<file>' in bucket `project-documents` is copied to
//     '<project>/photos/<file>' in bucket `project-media` when a photos row points at the new path, and the source
//     is removed once the copy succeeded (an existing target counts as copied);
//   * every other object in `project-documents` that no `documents` row points at (the files of deleted archived
//     documents, installation photos without a photos row) is removed, unless it is younger than one hour, so an
//     upload whose row insert is still in flight is never touched.
//
// Run with:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/move-installation-photos.ts [--dry-run]
//
// No fallbacks: both variables are required, and a missing one fails loudly by name. The service-role key is a
// secret and is never printed. --dry-run lists what would be copied and removed and changes nothing. The script is
// safe to run twice. The demo reseeds anyway; this is for any database that holds real data.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET = "project-documents";
const MEDIA_BUCKET = "project-media";
const GRACE_MS = 60 * 60 * 1000;
const PAGE = 1000;

export type StoredObject = { path: string; createdAt: string | null };
export type Action =
  | { kind: "move"; from: string; to: string }
  | { kind: "remove"; path: string; reason: "unreferenced" }
  | { kind: "skip"; path: string; reason: "referenced" | "recent" };

/** Pure planner: what to do with each object, given the document and photo paths the database knows. */
export function planActions(
  objects: StoredObject[],
  documentPaths: ReadonlySet<string>,
  photoPaths: ReadonlySet<string>,
  now: number,
): Action[] {
  return objects.map((o): Action => {
    if (documentPaths.has(o.path)) return { kind: "skip", path: o.path, reason: "referenced" };
    const m = /^([^/]+)\/installation_photos\/(.+)$/.exec(o.path);
    if (m) {
      const to = `${m[1]}/photos/${m[2]}`;
      if (photoPaths.has(to)) return { kind: "move", from: o.path, to };
    }
    const age = o.createdAt ? now - new Date(o.createdAt).getTime() : Number.POSITIVE_INFINITY;
    if (age < GRACE_MS) return { kind: "skip", path: o.path, reason: "recent" };
    return { kind: "remove", path: o.path, reason: "unreferenced" };
  });
}

function requireEnv(): { url: string; key: string } {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  return { url: process.env.SUPABASE_URL as string, key: process.env.SUPABASE_SERVICE_ROLE_KEY as string };
}

async function listFolder(db: SupabaseClient, prefix: string) {
  const out: { name: string; id: string | null; created_at: string | null }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(DOCUMENTS_BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Every object in the documents bucket ('<project>/<category>/<file>'). */
async function listObjects(db: SupabaseClient): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  for (const project of await listFolder(db, "")) {
    for (const category of await listFolder(db, project.name)) {
      for (const file of await listFolder(db, `${project.name}/${category.name}`)) {
        if (file.id) objects.push({ path: `${project.name}/${category.name}/${file.name}`, createdAt: file.created_at });
      }
    }
  }
  return objects;
}

async function storagePaths(db: SupabaseClient, table: "documents" | "photos"): Promise<string[]> {
  const paths: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select("storage_path")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    paths.push(...(data ?? []).map((r: { storage_path: string }) => r.storage_path));
    if (!data || data.length < PAGE) return paths;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { url, key } = requireEnv();
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [objects, documentPaths, photoPaths] = await Promise.all([
    listObjects(db),
    storagePaths(db, "documents"),
    storagePaths(db, "photos"),
  ]);
  const actions = planActions(objects, new Set(documentPaths), new Set(photoPaths), Date.now());
  const count = (k: Action["kind"]) => actions.filter((a) => a.kind === k).length;
  console.log(
    `${dryRun ? "[dry run] " : ""}${objects.length} object(s) in ${DOCUMENTS_BUCKET}: ${count("move")} to move, ${count("remove")} to remove, ${count("skip")} to keep`,
  );

  let failed = 0;
  for (const a of actions) {
    if (a.kind === "skip") continue;
    if (a.kind === "remove") {
      console.log(`${dryRun ? "would remove" : "remove"} ${DOCUMENTS_BUCKET}/${a.path}`);
      if (dryRun) continue;
      const { error } = await db.storage.from(DOCUMENTS_BUCKET).remove([a.path]);
      if (error) {
        failed++;
        console.error(`  failed: ${error.message}`);
      }
      continue;
    }
    console.log(`${dryRun ? "would move" : "move"} ${DOCUMENTS_BUCKET}/${a.from} -> ${MEDIA_BUCKET}/${a.to}`);
    if (dryRun) continue;
    const { error: copyError } = await db.storage.from(DOCUMENTS_BUCKET).copy(a.from, a.to, { destinationBucket: MEDIA_BUCKET });
    // An object already at the target means an earlier run copied it; the source can go.
    if (copyError && !/already exists|duplicate/i.test(copyError.message)) {
      failed++;
      console.error(`  copy failed, source kept: ${copyError.message}`);
      continue;
    }
    const { error: removeError } = await db.storage.from(DOCUMENTS_BUCKET).remove([a.from]);
    if (removeError) {
      failed++;
      console.error(`  copied, but removing the source failed: ${removeError.message}`);
    }
  }

  if (failed) {
    console.error(`${failed} step(s) failed; re-run to retry`);
    process.exit(1);
  }
  console.log(dryRun ? "Dry run complete; nothing changed." : "Done.");
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "unexpected error");
    process.exit(1);
  });
}
