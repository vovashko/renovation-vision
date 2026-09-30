import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Duplicates the eslint.config.js layer-boundary rules (README.md → Architecture) as a guard that
// can't be switched off by editing eslint config: routes and feature UI don't talk to Supabase or a
// repository directly, domain stays pure, the deleted `@/lib/api`/`@/lib/queries` shims never come
// back, and no `@deprecated` shim survives under src/lib (T17 removed all of them).
// Plain fs + regex on purpose — no ts-morph/AST parsing — so this stays fast in `bun run test`.

const SRC_ROOT = path.resolve(__dirname, "../../../src");

function listFiles(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, exts, out);
    } else if (entry.isFile() && exts.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function importsMatching(content: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  for (const m of content.matchAll(/from\s+["']([^"']+)["']/g)) {
    if (pattern.test(m[1])) matches.push(m[1]);
  }
  return matches;
}

const allTsFiles = listFiles(SRC_ROOT, [".ts", ".tsx"]);
const routesAndFeatureUi = allTsFiles.filter((f) => {
  const rel = path.relative(SRC_ROOT, f);
  return /^routes\//.test(rel) || /^features\/[^/]+\/ui\//.test(rel);
});
const domainFiles = allTsFiles.filter((f) => /^domain\//.test(path.relative(SRC_ROOT, f)));

describe("architecture boundaries (README.md → Architecture)", () => {
  it("routes and features/*/ui never import @/lib/supabase or a features/*/data repository", () => {
    const offenders: string[] = [];
    for (const file of routesAndFeatureUi) {
      const rel = path.relative(SRC_ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const spec of importsMatching(content, /^@\/lib\/supabase$/)) {
        offenders.push(`${rel}: imports "${spec}"`);
      }
      for (const spec of importsMatching(content, /^@\/features\/[^/]+\/data(\/|$)/)) {
        offenders.push(`${rel}: imports "${spec}"`);
      }
    }
    expect(offenders, ["Routes and feature UI use a hook from features/<f>/hooks instead.", ...offenders].join("\n")).toEqual([]);
  });

  it("src/domain stays pure: no React, no Supabase, no UI imports", () => {
    const offenders: string[] = [];
    for (const file of domainFiles) {
      const rel = path.relative(SRC_ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const spec of importsMatching(content, /^(react|react-dom)(\/|$)/)) {
        offenders.push(`${rel}: imports "${spec}"`);
      }
      for (const spec of importsMatching(content, /^@supabase\//)) {
        offenders.push(`${rel}: imports "${spec}"`);
      }
      for (const spec of importsMatching(content, /^@\/components\//)) {
        offenders.push(`${rel}: imports "${spec}"`);
      }
    }
    expect(offenders, ["src/domain must stay pure (no React, Supabase or UI imports).", ...offenders].join("\n")).toEqual([]);
  });

  it("nothing imports the deleted @/lib/api or @/lib/queries shims", () => {
    const offenders: string[] = [];
    for (const file of allTsFiles) {
      const rel = path.relative(SRC_ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const spec of importsMatching(content, /^@\/lib\/(api|queries)$/)) {
        offenders.push(`${rel}: imports "${spec}"`);
      }
    }
    expect(
      offenders,
      ["@/lib/api and @/lib/queries were removed in T17: use features/<f>/data and @/shared/query-keys.", ...offenders].join("\n"),
    ).toEqual([]);
  });

  it("no @deprecated shim remains under src/lib", () => {
    const libDir = path.join(SRC_ROOT, "lib");
    const offenders: string[] = [];
    for (const entry of fs.readdirSync(libDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const full = path.join(libDir, entry.name);
      const content = fs.readFileSync(full, "utf8");
      if (content.includes("@deprecated")) offenders.push(entry.name);
    }
    expect(offenders, ["T17 removed every deprecated src/lib shim; none should come back.", ...offenders].join("\n")).toEqual([]);
  });
});

// Server boundaries (README → Server functions & security), mirrored from eslint.config.js.
// Imports are resolved to src-relative module ids ("lib/supabase/admin", "server/functions/me"), so
// `@/…`, relative and `export … from` / `import(…)` spellings are all caught.

function moduleSpecifiers(content: string): string[] {
  const specs: string[] = [];
  for (const m of content.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) specs.push(m[1]);
  return specs;
}

/** The src-relative id of an import ("lib/supabase/admin"), or undefined for packages. */
function resolveToSrc(fromFile: string, spec: string): string | undefined {
  let absolute: string;
  if (spec.startsWith("@/")) absolute = path.join(SRC_ROOT, spec.slice(2));
  else if (spec.startsWith(".")) absolute = path.resolve(path.dirname(fromFile), spec);
  else return undefined;
  return path
    .relative(SRC_ROOT, absolute)
    .replace(/\.(ts|tsx)$/, "")
    .replace(/\/index$/, "");
}

function srcImports(file: string): string[] {
  return moduleSpecifiers(fs.readFileSync(file, "utf8"))
    .map((spec) => resolveToSrc(file, spec))
    .filter((id): id is string => id !== undefined);
}

const rel = (file: string) => path.relative(SRC_ROOT, file);

describe("server boundaries (README.md → Server functions & security)", () => {
  it("only src/server/** imports the admin Supabase client (it bypasses RLS)", () => {
    const offenders = allTsFiles
      .filter((file) => !rel(file).startsWith("server/"))
      .flatMap((file) =>
        srcImports(file)
          .filter((id) => id === "lib/supabase/admin")
          .map(() => `${rel(file)}: imports lib/supabase/admin`),
      );
    expect(offenders, ["Use the admin client from a server function in src/server/** only.", ...offenders].join("\n")).toEqual([]);
  });

  it("@/lib/supabase (the browser client) never re-exports the server or admin clients", () => {
    const index = path.join(SRC_ROOT, "lib/supabase/index.ts");
    expect(srcImports(index).filter((id) => /lib\/supabase\/(server|admin)$/.test(id))).toEqual([]);
  });

  it("server-only modules carry TanStack Start's server-only marker", () => {
    const serverOnly = ["lib/env.ts", "lib/supabase/server.ts", "lib/supabase/admin.ts"];
    const missing = serverOnly.filter(
      (file) => !fs.readFileSync(path.join(SRC_ROOT, file), "utf8").includes('import "@tanstack/react-start/server-only"'),
    );
    expect(missing, 'Add `import "@tanstack/react-start/server-only";` so the client build fails if the browser imports it.').toEqual([]);
  });

  it("only src/server/fn.ts calls createServerFn (every server function gets the boundary, auth and rate limit)", () => {
    const offenders = allTsFiles
      .filter((file) => rel(file) !== "server/fn.ts" && /\bcreateServerFn\b/.test(fs.readFileSync(file, "utf8")))
      .map(rel);
    expect(offenders, ["Build server functions from authedFn/publicFn in @/server/fn.", ...offenders].join("\n")).toEqual([]);
  });

  it("client-facing code imports only server functions and @/server/errors from src/server, and no server-only module", () => {
    const clientFacing = allTsFiles.filter((file) => /^(features|routes|components|shared|domain|i18n)\//.test(rel(file)));
    const offenders: string[] = [];
    for (const file of clientFacing) {
      for (const id of srcImports(file)) {
        const serverInternal = id.startsWith("server/") && !/^server\/(functions\/[^/.]+|errors)$/.test(id);
        const serverOnly = /\.server$/.test(id) || ["lib/env", "lib/supabase/server", "lib/supabase/admin"].includes(id);
        if (serverInternal || serverOnly) offenders.push(`${rel(file)}: imports ${id}`);
      }
    }
    expect(offenders, ["Call a server function (via a features/<f>/hooks hook) instead.", ...offenders].join("\n")).toEqual([]);
  });

  it("client-only code (*.client.ts(x), the design system, domain) never imports src/server", () => {
    const clientOnly = allTsFiles.filter((file) => /\.client\.tsx?$/.test(file) || /^(components\/ui|domain)\//.test(rel(file)));
    const offenders = clientOnly.flatMap((file) =>
      srcImports(file)
        .filter((id) => id === "server" || id.startsWith("server/"))
        .map((id) => `${rel(file)}: imports ${id}`),
    );
    expect(offenders).toEqual([]);
  });

  it("only src/server, src/start.ts and src/server.ts import the middleware, request context or fn builders", () => {
    const offenders = allTsFiles
      .filter((file) => !rel(file).startsWith("server/") && !["start.ts", "server.ts"].includes(rel(file)))
      .flatMap((file) =>
        srcImports(file)
          .filter((id) => /^server\/(middleware\/|request-context|auth\.server|rate-limit\.server|fn$)/.test(id))
          .map((id) => `${rel(file)}: imports ${id}`),
      );
    expect(offenders).toEqual([]);
  });
});
