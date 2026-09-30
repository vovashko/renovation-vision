// Stand-in for the `cloudflare:workers` runtime module in vitest (aliased in vitest.config.ts).
// Tests mutate `env` to simulate Worker bindings and secrets, e.g. `env.SUPABASE_SECRET_KEY = "…"`,
// and should restore it afterwards with `resetWorkerEnv()`.
export const env: Record<string, unknown> = {};

export function resetWorkerEnv(values: Record<string, unknown> = {}) {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, values);
}
