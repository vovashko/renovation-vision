// Security response headers (CSP and friends) for HTML pages. Registered as a request middleware
// in src/start.ts, outside errorMiddleware so the branded 500 page gets them too: it calls
// `next()` and only touches the response when its content-type is text/html, leaving
// server-function (JSON) and asset responses untouched.
//
// Script nonce. TanStack Start (1.170, @tanstack/router-core) *can* stamp a per-request nonce onto
// its inline hydration scripts: `createHydrationScripts`/`getSsrBodyScriptParts` both read
// `router.options.ssr?.nonce` (see node_modules/@tanstack/router-core/dist/esm/ssr/{hydrationScripts,
// ssr-server,bodyScripts}.js). Wiring a per-request nonce through means passing `ssr: { nonce }` to
// `createRouter()` in src/router.tsx — T21's file (router/session work) — with the nonce itself
// threaded from this middleware's request context. We didn't touch that file to stay out of T21's
// scope, so for this PR `script-src` uses 'unsafe-inline' as the tightest working fallback
// (documented here and in the PR). Follow-up: once router.tsx can accept a nonce, generate one per
// request here (e.g. via request-context.server.ts), pass it to `getRouter`, and tighten
// `script-src` to `'self' 'nonce-<value>'`.
import { createMiddleware } from "@tanstack/react-start";
import { getPublicEnv } from "@/lib/env";

/** Placeholder for the Sentry ingest host: T26 (observability) sets this once Sentry is wired up. */
export const SENTRY_INGEST_HOST: string | undefined = undefined;

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
};

/** Pure: the Content-Security-Policy header value. Exported for tests. */
export function buildCsp({ supabaseUrl, isDev }: CspOptions): string {
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const connectSrc = [
    "'self'",
    supabaseOrigin,
    wsOrigin(supabaseUrl),
    ...(isDev ? ["ws:"] : []),
    ...(SENTRY_INGEST_HOST ? [SENTRY_INGEST_HOST] : []),
  ];
  // No nonce support wired yet (see file header) — 'unsafe-inline' is the documented fallback.
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])];
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

/** Pure: the full header set for an HTML response. Exported for tests. */
export function buildSecurityHeaders(opts: CspOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(opts),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
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
  const result = await next();
  const response = (result as { response?: Response }).response;
  if (response && isHtmlResponse(response)) {
    const headers = buildSecurityHeaders({ supabaseUrl: getPublicEnv().url, isDev: import.meta.env.DEV });
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  }
  return result;
});
