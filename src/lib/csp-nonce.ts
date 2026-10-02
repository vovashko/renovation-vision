// The current request's CSP script nonce, for TanStack Start's `createRouter({ ssr: { nonce } })`
// (src/router.tsx). `src/server/middleware/security-headers.ts` generates one per request and
// stashes it on the response (via `setResponseHeader(NONCE_HEADER, ...)`) *before* calling
// `next()`, so it's already readable (via `getResponseHeader`, same request) by the time TanStack
// Start builds the router deeper in that same call — security-headers.ts imports `NONCE_HEADER`
// from here rather than the reverse, since only src/server/**, src/start.ts and src/server.ts may
// import a server middleware (see tests/unit/arch/boundaries.test.ts), and this file (src/lib/**)
// is imported by the isomorphic src/router.tsx.
//
// Isomorphic via `createIsomorphicFn` (like src/i18n/request-locale.ts): in the browser there's no
// nonce to read (and none is needed — only the server-rendered HTML's hydration scripts carry
// one), so this is always undefined there.
import { createIsomorphicFn } from "@tanstack/react-start";
import { getResponseHeader } from "@tanstack/react-start/server";

/** Request-scoped, not sensitive (a CSP nonce is public once it's in the HTML); internal only. */
export const NONCE_HEADER = "x-csp-nonce";

export const getCspNonce = createIsomorphicFn()
  .server((): string | undefined => getResponseHeader(NONCE_HEADER) as string | undefined)
  .client((): string | undefined => undefined);
