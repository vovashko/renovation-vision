// Rate limiting for server functions, on Cloudflare's Workers Rate Limiting binding.
//
//   authedFn({ method: "POST" }).middleware([rateLimit({ key: "invite" })])…
//
// Policies (limit/period per key) are in ../rate-limits.ts, mirrored by wrangler.jsonc. The counter
// is per user (`user:<id>`) when requireUser ran before this middleware, otherwise per client IP
// (`ip:<cf-connecting-ip>`). Over the limit → 429 RATE_LIMITED with `Retry-After` (seconds).
// Without the binding (unit tests, some dev setups) an in-memory limiter takes over; see
// ../rate-limit.server.ts.
import { createMiddleware } from "@tanstack/react-start";
import { ServerFnError } from "../errors";
import { checkRateLimit, rateLimitSubject } from "../rate-limit.server";
import type { RateLimitKey } from "../rate-limits";

function createRateLimitMiddleware(key: RateLimitKey) {
  return createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const result = await checkRateLimit(key, rateLimitSubject(context));
    if (!result.ok) {
      throw new ServerFnError("RATE_LIMITED", "Too many requests. Try again shortly.", {
        retryAfter: result.retryAfter,
        reason: `rate_limit_${key}`,
      });
    }
    return next();
  });
}

const middlewareByKey = new Map<RateLimitKey, ReturnType<typeof createRateLimitMiddleware>>();

/**
 * Function middleware: 429 RATE_LIMITED (with Retry-After) once the caller exceeds the `key` policy.
 * Returns the same middleware object per key, so listing it twice in a chain still counts once.
 */
export function rateLimit({ key }: { key: RateLimitKey }) {
  let middleware = middlewareByKey.get(key);
  if (!middleware) {
    middleware = createRateLimitMiddleware(key);
    middlewareByKey.set(key, middleware);
  }
  return middleware;
}
