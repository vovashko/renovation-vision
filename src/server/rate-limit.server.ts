// The logic behind `rateLimit()` (./middleware/rate-limit.ts), server-only.
//
// With the Workers Rate Limiting binding (wrangler.jsonc → ratelimits; simulated locally by
// Miniflare in `vite dev`/`vite preview`) the counter lives at Cloudflare, per location and
// eventually consistent: abuse protection, not an exact quota. When the binding is missing (unit
// tests, a dev setup without it) an in-memory fixed-window limiter takes over, per isolate, and
// that is logged once per binding.
import { getRequestHeader } from "@tanstack/react-start/server";
import { getWorkerBinding } from "@/lib/env";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, type RateLimitKey, type RateLimitPolicy } from "./rate-limits";

/** The Workers Rate Limiting binding API. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

const windows = new Map<string, { count: number; resetAt: number }>();
const warnedMissing = new Set<string>();

function memoryLimit(id: string, policy: RateLimitPolicy, now: number): RateLimitResult {
  if (windows.size > 10_000) for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
  let window = windows.get(id);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + policy.period * 1000 };
    windows.set(id, window);
  }
  window.count += 1;
  if (window.count <= policy.limit) return { ok: true };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000)) };
}

/** Test hook: forget the in-memory counters and the "binding missing" warnings. */
export function resetMemoryRateLimiter() {
  windows.clear();
  warnedMissing.clear();
}

/** Counts one hit for `subject` under the policy `key`. */
export async function checkRateLimit(key: RateLimitKey, subject: string, now = Date.now()): Promise<RateLimitResult> {
  const policy: RateLimitPolicy = RATE_LIMITS[key];
  const binding = getWorkerBinding<RateLimitBinding>(policy.binding);
  if (binding && typeof binding.limit === "function") {
    const { success } = await binding.limit({ key: subject });
    // The binding doesn't say when the window resets; the full period is a safe upper bound.
    return success ? { ok: true } : { ok: false, retryAfter: policy.period };
  }
  if (!warnedMissing.has(policy.binding)) {
    warnedMissing.add(policy.binding);
    logger.warn("rate limit binding missing; using the in-memory limiter (per isolate, not shared)", { binding: policy.binding });
  }
  return memoryLimit(`${key}:${subject}`, policy, now);
}

/** Who a request counts against: the user if an auth middleware ran first, else the client IP Cloudflare saw. */
export function rateLimitSubject(context: unknown): string {
  const userId = (context as { user?: { id?: unknown } } | undefined)?.user?.id;
  if (typeof userId === "string" && userId) return `user:${userId}`;
  // cf-connecting-ip is set by Cloudflare and can't be spoofed by the client (unlike x-forwarded-for).
  return `ip:${getRequestHeader("cf-connecting-ip") ?? "unknown"}`;
}
