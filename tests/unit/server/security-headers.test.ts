import { describe, expect, it, vi } from "vitest";

const SUPABASE_URL = "http://127.0.0.1:54321";

// security-headers.ts reads the Supabase URL via `@/lib/env`'s getPublicEnv(), which in turn reads
// `import.meta.env.VITE_SUPABASE_URL` — real in a dev/build checkout (.env.local), unset in CI. Mocked
// here (hoisted above everything else in this file, including the dynamic import below) so this suite
// never depends on a local env file. The factory uses a literal, not the `SUPABASE_URL` const above:
// vi.mock calls are hoisted above regular declarations too, so referencing it here would hit the TDZ.
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ url: "http://127.0.0.1:54321", key: "sb_publishable_x" }) }));

const { buildCsp, buildSecurityHeaders, securityHeadersMiddleware } = await import("@/server/middleware/security-headers");

describe("buildCsp", () => {
  it("includes every required directive, 'self' as the default, and the Supabase URL (http + ws locally)", () => {
    const csp = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src https://fonts.gstatic.com");
    expect(csp).toContain(`img-src 'self' data: blob: ${SUPABASE_URL}`);
    expect(csp).toContain(`connect-src 'self' ${SUPABASE_URL} ws://127.0.0.1:54321`);
    expect(csp).not.toContain("ws:'"); // no bare dev relaxation outside dev
  });

  it("uses wss:// for an https Supabase URL", () => {
    const csp = buildCsp({ supabaseUrl: "https://abcd.supabase.co", isDev: false });
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
  });

  it("documents the no-nonce decision: script-src is 'self' 'unsafe-inline' (no nonce wiring yet)", () => {
    const csp = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false });
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("nonce-");
  });

  it("relaxes only script-src (unsafe-eval) and connect-src (ws:) in dev, for Vite HMR", () => {
    const csp = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: true });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("ws:");
    // every other directive stays exactly as strict as the production policy
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("buildSecurityHeaders", () => {
  it("sets every required header on a non-dev (build/preview/production) response", () => {
    const headers = buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDev: false });
    expect(headers["Content-Security-Policy"]).toBeTruthy();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(self), microphone=(), geolocation=()");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
  });

  it("omits Strict-Transport-Security in dev", () => {
    const headers = buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDev: true });
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toBeTruthy(); // everything else still applies
  });
});

// `import.meta.env.DEV` is a build-time constant Vite statically replaces; it can't be flipped at
// runtime in a test. Vitest itself runs with DEV=true (MODE=test), which conveniently exercises the
// "vite dev" branch end to end here; the false (build/preview/production) branch — and the exact
// dev-vs-non-dev header differences — are fully covered by the buildCsp/buildSecurityHeaders tests
// above, which take `isDev` as a plain argument.
describe("securityHeadersMiddleware", () => {
  function serverFn(middleware: unknown) {
    return (middleware as { options: { server: (opts: unknown) => Promise<unknown> } }).options.server;
  }

  it("adds the headers to an HTML page response, wired to the (mocked) Supabase URL", async () => {
    const response = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
    const result = (await serverFn(securityHeadersMiddleware)({ next: async () => ({ response }) })) as { response: Response };
    expect(result.response.headers.get("Content-Security-Policy")).toContain(SUPABASE_URL);
    expect(result.response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(result.response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(result.response.headers.get("Permissions-Policy")).toBe("camera=(self), microphone=(), geolocation=()");
  });

  it("leaves a non-HTML response (server function JSON) untouched", async () => {
    const response = new Response("{}", { headers: { "content-type": "application/json" } });
    const result = (await serverFn(securityHeadersMiddleware)({ next: async () => ({ response }) })) as { response: Response };
    expect(result.response.headers.get("Content-Security-Policy")).toBeNull();
    expect(result.response.headers.get("X-Content-Type-Options")).toBeNull();
  });
});
