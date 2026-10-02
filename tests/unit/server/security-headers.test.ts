import { describe, expect, it, vi } from "vitest";

const SUPABASE_URL = "http://127.0.0.1:54321";
const NONCE = "abc123nonce==";

// security-headers.ts reads the Supabase URL via `@/lib/env`'s getPublicEnv(), which in turn reads
// `import.meta.env.VITE_SUPABASE_URL` — real in a dev/build checkout (.env.local), unset in CI. Mocked
// here (hoisted above everything else in this file, including the dynamic import below) so this suite
// never depends on a local env file. The factory uses a literal, not the `SUPABASE_URL` const above:
// vi.mock calls are hoisted above regular declarations too, so referencing it here would hit the TDZ.
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ url: "http://127.0.0.1:54321", key: "sb_publishable_x" }) }));

const h = vi.hoisted(() => ({ responseHeaders: {} as Record<string, string> }));
vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: (name: string, value: string) => void (h.responseHeaders[name] = value),
  getResponseHeader: (name: string) => h.responseHeaders[name],
  removeResponseHeader: (name: string) => void delete h.responseHeaders[name],
}));

const { buildCsp, buildSecurityHeaders, generateNonce, HELMET_EQUIVALENT_HEADERS, sentryIngestOrigin, securityHeadersMiddleware } =
  await import("@/server/middleware/security-headers");
const { NONCE_HEADER } = await import("@/lib/csp-nonce");

describe("buildCsp", () => {
  it("includes every required directive, 'self' as the default, and the Supabase URL (http + ws locally)", () => {
    const csp = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: NONCE });
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
    const csp = buildCsp({ supabaseUrl: "https://abcd.supabase.co", isDev: false, nonce: NONCE });
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
  });

  it("outside dev, script-src is 'self' plus the request's nonce, and never 'unsafe-inline'", () => {
    const csp = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: NONCE });
    expect(csp).toContain(`script-src 'self' 'nonce-${NONCE}'`);
    expect(csp).not.toContain("unsafe-inline' 'nonce"); // no unsafe-inline anywhere in script-src
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("a different nonce produces a different script-src", () => {
    const a = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: "nonce-a" });
    const b = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: "nonce-b" });
    expect(a).not.toBe(b);
    expect(a).toContain("'nonce-nonce-a'");
    expect(b).toContain("'nonce-nonce-b'");
  });

  it("relaxes only script-src (unsafe-inline + unsafe-eval, no nonce) and connect-src (ws:) in dev, for Vite HMR", () => {
    const csp = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: true, nonce: NONCE });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).not.toContain("nonce-"); // mixing a nonce with 'unsafe-inline' would defeat the dev relaxation
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("ws:");
    // every other directive stays exactly as strict as the production policy
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("adds the Sentry ingest origin to connect-src when one is configured", () => {
    const withSentry = buildCsp({
      supabaseUrl: SUPABASE_URL,
      isDev: false,
      nonce: NONCE,
      sentryIngestOrigin: "https://o0.ingest.de.sentry.io",
    });
    expect(withSentry).toContain(`connect-src 'self' ${SUPABASE_URL} ws://127.0.0.1:54321 https://o0.ingest.de.sentry.io`);
    const without = buildCsp({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: NONCE });
    expect(without).not.toContain("sentry.io");
  });
});

describe("sentryIngestOrigin", () => {
  it("extracts the origin from a DSN, dropping the public key", () => {
    expect(sentryIngestOrigin("https://public@o0.ingest.de.sentry.io/0")).toBe("https://o0.ingest.de.sentry.io");
  });

  it("is undefined when there's no DSN or it's malformed", () => {
    expect(sentryIngestOrigin(undefined)).toBeUndefined();
    expect(sentryIngestOrigin("not a url")).toBeUndefined();
  });
});

describe("generateNonce", () => {
  it("generates a fresh, non-empty value every call", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });
});

describe("buildSecurityHeaders", () => {
  it("sets every required header on a non-dev (build/preview/production) response", () => {
    const headers = buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: NONCE });
    expect(headers["Content-Security-Policy"]).toBeTruthy();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(self), microphone=(), geolocation=()");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
  });

  it("omits Strict-Transport-Security in dev", () => {
    const headers = buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDev: true, nonce: NONCE });
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toBeTruthy(); // everything else still applies
  });

  // The helmet-equivalent headers (see the PR discussion: helmet itself is Express/Node
  // middleware and doesn't apply to a TanStack Start/h3 app on Cloudflare Workers).
  it("sets the helmet-equivalent headers, and never Cross-Origin-Embedder-Policy", () => {
    const headers = buildSecurityHeaders({ supabaseUrl: SUPABASE_URL, isDev: false, nonce: NONCE });
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Origin-Agent-Cluster"]).toBe("?1");
    expect(headers["X-Permitted-Cross-Domain-Policies"]).toBe("none");
    expect(headers["X-DNS-Prefetch-Control"]).toBe("off");
    expect(headers["Cross-Origin-Embedder-Policy"]).toBeUndefined(); // would block cross-origin Supabase images and Google Fonts
  });
});

describe("HELMET_EQUIVALENT_HEADERS", () => {
  it("is the fixed set /healthz also uses (src/server/healthz.ts)", () => {
    expect(HELMET_EQUIVALENT_HEADERS).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Origin-Agent-Cluster": "?1",
      "X-Permitted-Cross-Domain-Policies": "none",
      "X-DNS-Prefetch-Control": "off",
    });
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
    expect(result.response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(result.response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("generates a nonce before calling next(), readable via getResponseHeader (as src/lib/csp-nonce.ts does)", async () => {
    h.responseHeaders = {};
    let seenDuringNext: string | undefined;
    const response = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
    await serverFn(securityHeadersMiddleware)({
      next: async () => {
        // Simulates src/lib/csp-nonce.ts (and so src/router.tsx) reading it back while the router
        // renders, deeper inside this same `next()` call.
        seenDuringNext = h.responseHeaders[NONCE_HEADER];
        return { response };
      },
    });
    expect(seenDuringNext).toBeTruthy();
  });

  // import.meta.env.DEV is true under vitest (see the note above), so this suite can't exercise the
  // nonce actually landing in script-src end to end through the middleware — that binding (nonce in
  // script-src, no 'unsafe-inline', outside dev) is covered directly by the buildCsp tests above,
  // which take `isDev` as a plain argument instead of relying on the build-time constant.
  it("CSP's script-src carries the dev relaxations under vitest (DEV=true), not the nonce", async () => {
    const response = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
    const result = (await serverFn(securityHeadersMiddleware)({ next: async () => ({ response }) })) as { response: Response };
    expect(result.response.headers.get("Content-Security-Policy")).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("strips the internal nonce handoff header from the final response", async () => {
    const response = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
    const result = (await serverFn(securityHeadersMiddleware)({ next: async () => ({ response }) })) as { response: Response };
    expect(result.response.headers.has(NONCE_HEADER)).toBe(false);
  });

  it("uses a different nonce on each call", async () => {
    const seen: string[] = [];
    for (let i = 0; i < 2; i++) {
      h.responseHeaders = {};
      const response = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
      await serverFn(securityHeadersMiddleware)({
        next: async () => {
          seen.push(h.responseHeaders[NONCE_HEADER]);
          return { response };
        },
      });
    }
    expect(seen[0]).not.toBe(seen[1]);
  });

  it("leaves a non-HTML response (server function JSON) untouched", async () => {
    const response = new Response("{}", { headers: { "content-type": "application/json" } });
    const result = (await serverFn(securityHeadersMiddleware)({ next: async () => ({ response }) })) as { response: Response };
    expect(result.response.headers.get("Content-Security-Policy")).toBeNull();
    expect(result.response.headers.get("X-Content-Type-Options")).toBeNull();
  });
});
