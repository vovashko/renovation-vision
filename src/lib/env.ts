// Server configuration: the public `VITE_*` Supabase pair plus the Worker's secrets, validated with
// zod and failing with a message that names the variable and says where to set it.
//
// SERVER-ONLY. The marker import below makes TanStack Start's import protection fail the client
// build if anything in the browser graph imports this module, so secrets can't reach dist/client.
//
// Where values come from: `import { env } from "cloudflare:workers"`. That module is the Worker's
// bindings object, the same one `fetch(request, env)` receives, but importable at module scope.
// We use it rather than `process.env` because (a) it is the one source for every binding, including
// non-string ones like the rate limiters in wrangler.jsonc that `process.env` can't carry, and
// (b) it doesn't depend on the `nodejs_compat` process.env population behaviour. It works the same
// in `vite dev` (the Cloudflare Vite plugin runs SSR in workerd and loads `.dev.vars`), in
// `vite preview`/`wrangler dev`, and in production (`vars` + `wrangler secret put`). Unit tests
// alias it to tests/stubs/cloudflare-workers.ts.
import "@tanstack/react-start/server-only";
import { env as workerEnv } from "cloudflare:workers";
import { z } from "zod";
import { isSupabaseSecretKey, jwtRole, readPublicSupabaseEnv, validateSupabaseEnv, type SupabaseEnv } from "@/lib/supabase/env";

const WHERE =
  "Set it in .dev.vars locally (see .dev.vars.example; for the local stack use SECRET_KEY from `supabase status -o env`) " +
  "or with `wrangler secret put <NAME> --env <preview|production>` remotely. See README → Server functions & security.";

/** Thrown when the Worker's configuration is missing or malformed. The message is safe to log (never contains a secret). */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

export const APP_ENVS = ["development", "preview", "production", "test"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export type ServerEnv = {
  appEnv: AppEnv;
  /** The Supabase secret key (`sb_secret_…`, or the legacy service_role JWT); undefined when unset. */
  supabaseSecretKey: string | undefined;
  /** Which variable `supabaseSecretKey` came from, for log messages. */
  supabaseSecretKeySource: "SUPABASE_SECRET_KEY" | "SUPABASE_SERVICE_ROLE_KEY" | undefined;
  brevoApiKey: string | undefined;
  sentryDsn: string | undefined;
};

/** Empty or whitespace-only values count as unset (so `.dev.vars` can list a name with no value). */
const optionalString = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().optional());

function secretKeyProblem(name: string, value: string): string | undefined {
  if (isSupabaseSecretKey(value)) return undefined;
  if (value.startsWith("sb_publishable_") || jwtRole(value) === "anon") {
    return `${name} holds the publishable (anon) key, not the secret key. Use the secret key (sb_secret_…). ${WHERE}`;
  }
  return `${name} must be a Supabase secret key (sb_secret_…, or the legacy service_role JWT), but it is neither. ${WHERE}`;
}

const serverSchema = z
  .object({
    APP_ENV: z.preprocess(
      (value) => (value === undefined || value === "" ? "development" : value),
      z.enum(APP_ENVS, {
        errorMap: (_issue, ctx) => ({
          message: `APP_ENV must be one of ${APP_ENVS.join(", ")}, but it is "${String(ctx.data)}". It is set per environment in wrangler.jsonc → vars.`,
        }),
      }),
    ),
    SUPABASE_SECRET_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    BREVO_API_KEY: optionalString,
    SENTRY_DSN: optionalString.refine((value) => value === undefined || /^https:\/\/[^@\s]+@[^/\s]+\/\S+$/.test(value), {
      message: `SENTRY_DSN must look like https://<key>@<host>/<project-id>. ${WHERE}`,
    }),
  })
  .superRefine((env, ctx) => {
    for (const name of ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
      const value = env[name];
      const problem = value === undefined ? undefined : secretKeyProblem(name, value);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: problem });
    }
  });

/** Pure: validates a bindings object. Exported for tests; app code calls `getServerEnv()`. */
export function parseServerEnv(source: Record<string, unknown>): { ok: true; env: ServerEnv } | { ok: false; message: string } {
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) return { ok: false, message: `Server env is misconfigured: ${parsed.error.issues[0].message}` };
  const data = parsed.data;
  const supabaseSecretKeySource = data.SUPABASE_SECRET_KEY ? "SUPABASE_SECRET_KEY" : data.SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : undefined;
  return {
    ok: true,
    env: {
      appEnv: data.APP_ENV,
      supabaseSecretKey: data.SUPABASE_SECRET_KEY ?? data.SUPABASE_SERVICE_ROLE_KEY,
      supabaseSecretKeySource,
      brevoApiKey: data.BREVO_API_KEY,
      sentryDsn: data.SENTRY_DSN,
    },
  };
}

/** The validated server env. Throws `EnvError` when a value is present but malformed. Optional secrets may be undefined. */
export function getServerEnv(): ServerEnv {
  const result = parseServerEnv(workerEnv);
  if (!result.ok) throw new EnvError(result.message);
  return result.env;
}

/** The Supabase secret key, or an `EnvError` saying how to set it. Prefers SUPABASE_SECRET_KEY over the legacy name. */
export function requireSupabaseSecretKey(env: ServerEnv = getServerEnv()): string {
  if (!env.supabaseSecretKey) {
    throw new EnvError(`Server env is not configured: SUPABASE_SECRET_KEY is not set (the legacy SUPABASE_SERVICE_ROLE_KEY is accepted too). ${WHERE}`);
  }
  return env.supabaseSecretKey;
}

/**
 * Pure: validates the public Supabase pair and, because this runs on the server where the whole
 * `import.meta.env` object is visible, also refuses any `VITE_*` variable that holds a secret key
 * (it would be inlined into the browser bundle the moment client code referenced it).
 */
export function parsePublicEnv(source: Record<string, unknown>): { ok: true; env: SupabaseEnv } | { ok: false; message: string } {
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith("VITE_") && typeof value === "string" && isSupabaseSecretKey(value.trim())) {
      return {
        ok: false,
        message:
          `Supabase is misconfigured: ${name} holds a secret key. VITE_* values ship to every browser; ` +
          `put the secret key in SUPABASE_SECRET_KEY (.dev.vars / wrangler secret) instead, and rotate it if this build was ever deployed.`,
      };
    }
  }
  const url = source.VITE_SUPABASE_URL;
  const key = source.VITE_SUPABASE_PUBLISHABLE_KEY || source.VITE_SUPABASE_ANON_KEY;
  return validateSupabaseEnv({ url: typeof url === "string" ? url : undefined, key: typeof key === "string" ? key : undefined });
}

/** The validated public Supabase pair, for server-side clients. Throws `EnvError` with the same messages the browser shows. */
export function getPublicEnv(): SupabaseEnv {
  const result = parsePublicEnv({ ...import.meta.env, ...readPublicSupabaseEnv() });
  if (!result.ok) throw new EnvError(result.message);
  return result.env;
}

/** A Worker binding by name (e.g. a rate limiter), or undefined when it isn't declared (unit tests, some dev setups). */
export function getWorkerBinding<T>(name: string): T | undefined {
  return (workerEnv[name] as T | undefined) ?? undefined;
}
