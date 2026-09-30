// Minimal typing for the Workers runtime module. We don't pull in @cloudflare/workers-types (its
// global Request/Response/etc. clash with the DOM lib this app compiles against); src/lib/env.ts
// narrows the values it reads with zod instead.
declare module "cloudflare:workers" {
  /** The Worker's bindings: `vars`, secrets (`.dev.vars` / `wrangler secret put`), rate limiters… */
  export const env: Record<string, unknown>;
}
