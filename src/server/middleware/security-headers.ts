// Security response headers (CSP and friends) for HTML pages. Registered as a request middleware
// in src/start.ts, outside errorMiddleware so the branded 500 page gets them too: it calls
// `next()` and only touches the response when its content-type is text/html, leaving
// server-function (JSON) and asset responses untouched.
//
// Script nonce (T26, follow-up to T23). TanStack Start (1.170, @tanstack/router-core) stamps a
// per-request nonce onto its inline hydration scripts when `router.options.ssr?.nonce` is set
// (see node_modules/@tanstack/router-core/dist/esm/ssr/{hydrationScripts,ssr-server,
// bodyScripts}.js). We generate one random nonce per request, right here, *before* calling
// `next()`, and stash it on the response via `setResponseHeader(NONCE_HEADER, …)` so that
// src/lib/csp-nonce.ts (imported by the isomorphic src/router.tsx, which is built deeper inside
// that `next()` call) can read the very same value back with `getResponseHeader` and pass it to
// `createRouter({ ssr: { nonce } })`. `NONCE_HEADER` lives in src/lib/csp-nonce.ts, not here, so
// that file doesn't have to import a server middleware (see tests/unit/arch/boundaries.test.ts).
// The header is stripped from the final response before it leaves — it's not sensitive (a nonce is
// public the moment it's in the HTML/CSP header anyway), just an internal handoff.
import { createMiddleware } from "@tanstack/react-start";
import { removeResponseHeader, setResponseHeader } from "@tanstack/react-start/server";
import { NONCE_HEADER } from "@/lib/csp-nonce";
import { getPublicEnv } from "@/lib/env";

/** 128 bits of randomness, base64-encoded — a fresh value every request. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The Sentry ingest origin for `connect-src`, or undefined when no browser DSN is configured. */
export function sentryIngestOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) return undefined;
  try {
    return new URL(dsn).origin; // userinfo (the public key) is dropped by `.origin`
  } catch {
    return undefined;
  }
}

/** The websocket counterpart of an http(s) origin: http -> ws, https -> wss. */
function wsOrigin(httpOrigin: string): string {
  const url = new URL(httpOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "";
  return url.origin;
}

export type CspOptions = {
  /** `VITE_SUPABASE_URL`: also where Storage and Realtime live (same origin, different paths). */
  supabaseUrl: string;
  /** True under `vite dev` only; false for `vite build` output (preview, wrangler dev, production). */
  isDev: boolean;
  /** This request's script nonce (see the file header); required outside dev. */
  nonce: string;
  /** The browser Sentry DSN's origin, added to `connect-src` when a DSN is configured. */
  sentryIngestOrigin?: string;
};

/** Pure: the Content-Security-Policy header value. Exported for tests. */
export function buildCsp({ supabaseUrl, isDev, nonce, sentryIngestOrigin: sentryOrigin }: CspOptions): string {
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const connectSrc = ["'self'", supabaseOrigin, wsOrigin(supabaseUrl), ...(isDev ? ["ws:"] : []), ...(sentryOrigin ? [sentryOrigin] : [])];
  // Dev: Vite's HMR/React-refresh preamble injects its own inline scripts with no nonce, so
  // 'unsafe-inline' has to stay (mixing it with a nonce source would make CSP-Level-2+ browsers
  // ignore 'unsafe-inline' entirely, per spec, and break HMR). Everywhere else: nonce only.
  const scriptSrc = isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'", `'nonce-${nonce}'`];
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    ["img-src", ["'self'", "data:", "blob:", supabaseOrigin]],
    ["font-src", ["https://fonts.gstatic.com"]],
    ["connect-src", connectSrc],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

// The non-CSP, non-HSTS headers helmet (Express/Node middleware; doesn't apply here — this app is
// TanStack Start/h3 on Cloudflare Workers, not Express, so adding the package itself wouldn't work)
// sets by default, minus `Content-Security-Policy` and `Strict-Transport-Security` (handled above,
// with our own CSP) and `X-Powered-By` removal (we never set it). `Cross-Origin-Embedder-Policy` is
// deliberately NOT included: `require-corp` would block the cross-origin images (Supabase Storage)
// and fonts (Google Fonts) this app actually loads, since neither currently serves `Cross-Origin-
// Resource-Policy: cross-origin` or CORS headers for those requests. Exported so `/healthz`
// (src/server/healthz.ts), a non-HTML response outside the branch below, can reuse the same set.
export const HELMET_EQUIVALENT_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "DENY", // a legacy fallback for frame-ancestors 'none', for browsers that predate CSP2
  "Origin-Agent-Cluster": "?1",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-DNS-Prefetch-Control": "off",
};

/** Pure: the full header set for an HTML response. Exported for tests. */
export function buildSecurityHeaders(opts: CspOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(opts),
    ...HELMET_EQUIVALENT_HEADERS,
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  };
  // HSTS only makes sense once the app is actually served over TLS, which `vite dev` never is
  // (plain http, hot reload). `vite build` output (preview, wrangler dev, production deploys) gets it.
  if (!opts.isDev) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

function isHtmlResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("text/html");
}

/** Adds the header set to HTML page responses only; JSON (server functions) and other responses pass through. */
export const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  // Generated before `next()`: src/router.tsx reads it back (via src/lib/csp-nonce.ts) while
  // building the SSR router inside that call, so the hydration scripts and the CSP header below
  // always carry the same value for this request.
  const nonce = generateNonce();
  setResponseHeader(NONCE_HEADER, nonce);
  const result = await next();
  const response = (result as { response?: Response }).response;
  if (response && isHtmlResponse(response)) {
    const headers = buildSecurityHeaders({
      supabaseUrl: getPublicEnv().url,
      isDev: import.meta.env.DEV,
      nonce,
      sentryIngestOrigin: sentryIngestOrigin(import.meta.env.VITE_SENTRY_DSN as string | undefined),
    });
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  }
  // NONCE_HEADER was only ever a same-request handoff to src/router.tsx (via getResponseHeader in
  // src/lib/csp-nonce.ts); it isn't part of the public header contract. `setResponseHeader` writes
  // into a separate store that TanStack Start merges onto the response *after* this middleware
  // returns, so `response.headers.delete(...)` can't remove it — `removeResponseHeader` (the same
  // store) can.
  removeResponseHeader(NONCE_HEADER);
  response?.headers.delete(NONCE_HEADER);
  return result;
});
