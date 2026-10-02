// GET /healthz — a cheap, unauthenticated liveness check for uptime monitors. Handled directly in
// src/server.ts, before the TanStack Start handler (there's no server-route/API-route feature in
// the installed TanStack Start 1.168, only page routes and RPC server functions, neither of which
// fit a plain JSON endpoint well): no auth, no PII, no SSR/React overhead.
//
// `{ ok, version, time, checks: { worker: "ok", supabase: "ok" | "error" } }`, 200 when every check
// is ok, 503 otherwise. The Supabase check is a single unauthenticated GET to its Auth health
// endpoint with a short timeout, so a slow or unreachable Supabase can't hang this request.
import { getPublicEnv } from "@/lib/env";
import { SENTRY_RELEASE } from "@/lib/sentry-config";

const SUPABASE_CHECK_TIMEOUT_MS = 2000;

export type HealthStatus = "ok" | "error";
export type HealthBody = {
  ok: boolean;
  version: string;
  time: string;
  checks: { worker: HealthStatus; supabase: HealthStatus };
};

/** Pure-ish (fetch is injectable): GET `<supabaseUrl>/auth/v1/health` with the publishable key. */
export async function checkSupabaseHealth(
  supabaseUrl: string,
  publishableKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = SUPABASE_CHECK_TIMEOUT_MS,
): Promise<HealthStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL("/auth/v1/health", supabaseUrl), {
      headers: { apikey: publishableKey },
      signal: controller.signal,
    });
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  } finally {
    clearTimeout(timeout);
  }
}

/** Builds the full health response. Never throws: a misconfigured/unreachable Supabase is `"error"`, not a crash. */
export async function buildHealthResponse(fetchImpl: typeof fetch = fetch): Promise<Response> {
  let supabase: HealthStatus = "error";
  try {
    const { url, key } = getPublicEnv();
    supabase = await checkSupabaseHealth(url, key, fetchImpl);
  } catch {
    supabase = "error";
  }
  const ok = supabase === "ok";
  const body: HealthBody = { ok, version: SENTRY_RELEASE, time: new Date().toISOString(), checks: { worker: "ok", supabase } };
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 503,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
