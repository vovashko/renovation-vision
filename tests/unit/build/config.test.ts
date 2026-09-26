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
});
