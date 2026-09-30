// Rate-limit policies. Each one is a Workers Rate Limiting binding in wrangler.jsonc: Cloudflare fixes
// a binding's limit and period (10 or 60 s) in config, not per call, so the numbers live here and
// wrangler.jsonc mirrors them for the top level and every env (tests/unit/server/rate-limit.test.ts
// fails if they drift). To add a policy: add it here, then a binding with a new namespace_id at the
// top level and in each env of wrangler.jsonc.

export type RateLimitPolicy = { binding: string; limit: number; period: 10 | 60 };

export const RATE_LIMITS = {
  /** Every server function built from publicFn/authedFn. Generous: stops scripted abuse, not people. */
  default: { binding: "RATE_LIMIT_DEFAULT", limit: 120, period: 60 },
  /** Inviting people to a project (T24). */
  invite: { binding: "RATE_LIMIT_INVITE", limit: 10, period: 60 },
  /** Anything that sends an email (T24). */
  email: { binding: "RATE_LIMIT_EMAIL", limit: 5, period: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitKey = keyof typeof RATE_LIMITS;
