import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// vitest runs with the repo root as the working directory (see vitest.config.ts).
const root = `${resolve(process.cwd())}/`;

/** Strips `//` and `/* *\/` comments and trailing commas from a JSONC string so it can be parsed with JSON.parse. */
function stripJsonComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}

function readWranglerConfig(): Record<string, unknown> {
  const raw = readFileSync(`${root}wrangler.jsonc`, "utf8");
  return JSON.parse(stripJsonComments(raw));
}

describe("wrangler.jsonc", () => {
  it("parses as JSON once comments are stripped", () => {
    expect(() => readWranglerConfig()).not.toThrow();
  });

  it("enables observability", () => {
    const config = readWranglerConfig();
    expect((config.observability as { enabled?: boolean } | undefined)?.enabled).toBe(true);
  });

  it("keeps the nodejs_compat flag", () => {
    const config = readWranglerConfig();
    expect(config.compatibility_flags as string[]).toContain("nodejs_compat");
  });

  it("defines preview and production environments with distinct names", () => {
    const config = readWranglerConfig();
    const env = config.env as Record<string, { name?: string }>;
    expect(env.preview?.name).toBeTruthy();
    expect(env.production?.name).toBeTruthy();
    expect(env.preview?.name).not.toBe(env.production?.name);
  });
});

describe("vite.config.ts", () => {
  it("keeps the flat-route virtualRouteConfig wired up", () => {
    const source = readFileSync(`${root}vite.config.ts`, "utf8");
    expect(source).toContain("virtualRouteConfig");
  });

  it("selects the Wrangler environment at build time in the deploy scripts", () => {
    // @cloudflare/vite-plugin bakes the environment into dist/server/wrangler.json at build time; a build without
    // CLOUDFLARE_ENV deploys the top-level config under the production name, whatever `--env` says.
    const scripts = (JSON.parse(readFileSync(`${root}package.json`, "utf8")) as { scripts: Record<string, string> }).scripts;
    expect(scripts["deploy:preview"]).toMatch(/^CLOUDFLARE_ENV=preview bun run build && .*wrangler deploy$/);
    expect(scripts["deploy"]).toMatch(/^CLOUDFLARE_ENV=production bun run build && .*wrangler deploy$/);
    for (const script of [scripts["deploy:preview"], scripts["deploy"]]) {
      expect(script).toContain("strip-sourcemaps");
      expect(script).not.toContain("--env");
    }
  });
});
