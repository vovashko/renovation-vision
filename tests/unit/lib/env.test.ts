import { afterEach, describe, expect, it } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";
import { EnvError, getServerEnv, getWorkerBinding, parsePublicEnv, parseServerEnv, requireSupabaseSecretKey } from "@/lib/env";

// Fixtures are built at runtime so secret scanners don't mistake them for real keys.
const SECRET = ["sb", "secret", "not-a-real-key"].join("_");
const PUBLISHABLE = ["sb", "publishable", "not-a-real-key"].join("_");
const legacyJwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: "supabase-demo", role })).replace(/=+$/, "")}.sig`;

afterEach(() => resetWorkerEnv());

describe("parseServerEnv", () => {
  it("accepts an empty env: every secret is optional until something needs it", () => {
    const result = parseServerEnv({});
    expect(result).toEqual({
      ok: true,
      env: {
        appEnv: "development",
        supabaseSecretKey: undefined,
        supabaseSecretKeySource: undefined,
        brevoApiKey: undefined,
        sentryDsn: undefined,
      },
    });
  });

  it("treats blank values (a name listed in .dev.vars with nothing after =) as unset", () => {
    const result = parseServerEnv({ SUPABASE_SECRET_KEY: "  ", BREVO_API_KEY: "", APP_ENV: "" });
    expect(result.ok && result.env).toMatchObject({ appEnv: "development", supabaseSecretKey: undefined, brevoApiKey: undefined });
  });

  it("prefers SUPABASE_SECRET_KEY and falls back to the legacy SUPABASE_SERVICE_ROLE_KEY", () => {
    const both = parseServerEnv({ SUPABASE_SECRET_KEY: SECRET, SUPABASE_SERVICE_ROLE_KEY: legacyJwt("service_role") });
    expect(both.ok && both.env).toMatchObject({ supabaseSecretKey: SECRET, supabaseSecretKeySource: "SUPABASE_SECRET_KEY" });
    const legacy = parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: legacyJwt("service_role") });
    expect(legacy.ok && legacy.env).toMatchObject({
      supabaseSecretKey: legacyJwt("service_role"),
      supabaseSecretKeySource: "SUPABASE_SERVICE_ROLE_KEY",
    });
  });

  it("names the variable when the publishable key is put where the secret key belongs", () => {
    const result = parseServerEnv({ SUPABASE_SECRET_KEY: PUBLISHABLE });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(
      /SUPABASE_SECRET_KEY holds the publishable \(anon\) key.*sb_secret_.*\.dev\.vars.*wrangler secret put/s,
    );
  });

  it("rejects the legacy anon JWT as the secret key", () => {
    const result = parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: legacyJwt("anon") });
    expect(!result.ok && result.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY holds the publishable \(anon\) key/);
  });

  it("rejects a value that is not a Supabase key at all", () => {
    const result = parseServerEnv({ SUPABASE_SECRET_KEY: "hunter2" });
    expect(!result.ok && result.message).toMatch(/SUPABASE_SECRET_KEY must be a Supabase secret key/);
    expect(!result.ok && result.message).not.toContain("hunter2");
  });

  it("rejects an unknown APP_ENV and a malformed SENTRY_DSN", () => {
    expect(parseServerEnv({ APP_ENV: "staging" })).toEqual({
      ok: false,
      message: expect.stringMatching(/APP_ENV must be one of development, preview, production, test.*"staging"/),
    });
    expect(parseServerEnv({ SENTRY_DSN: "not-a-dsn" })).toEqual({
      ok: false,
      message: expect.stringMatching(/SENTRY_DSN must look like https:\/\/<key>@<host>\/<project-id>/),
    });
    expect(parseServerEnv({ SENTRY_DSN: "https://abc@o1.ingest.sentry.io/123" }).ok).toBe(true);
  });
});

describe("getServerEnv / requireSupabaseSecretKey (reading cloudflare:workers env)", () => {
  it("reads the Worker bindings", () => {
    resetWorkerEnv({ APP_ENV: "preview", SUPABASE_SECRET_KEY: SECRET });
    expect(getServerEnv()).toMatchObject({ appEnv: "preview", supabaseSecretKey: SECRET });
    expect(requireSupabaseSecretKey()).toBe(SECRET);
  });

  it("throws an EnvError that says how to set a missing secret key", () => {
    resetWorkerEnv({});
    expect(() => requireSupabaseSecretKey()).toThrow(EnvError);
    expect(() => requireSupabaseSecretKey()).toThrow(
      /SUPABASE_SECRET_KEY is not set.*SUPABASE_SERVICE_ROLE_KEY.*\.dev\.vars.*wrangler secret put/s,
    );
  });

  it("throws an EnvError for a malformed value", () => {
    resetWorkerEnv({ SUPABASE_SECRET_KEY: PUBLISHABLE });
    expect(() => getServerEnv()).toThrow(/Server env is misconfigured: SUPABASE_SECRET_KEY holds the publishable/);
  });

  it("exposes non-string bindings such as rate limiters", () => {
    const limiter = { limit: async () => ({ success: true }) };
    resetWorkerEnv({ RATE_LIMIT_DEFAULT: limiter });
    expect(getWorkerBinding("RATE_LIMIT_DEFAULT")).toBe(limiter);
    expect(getWorkerBinding("RATE_LIMIT_MISSING")).toBeUndefined();
  });
});

describe("parsePublicEnv", () => {
  it("still validates the public pair with the browser's messages", () => {
    expect(parsePublicEnv({})).toEqual({ ok: false, message: expect.stringMatching(/Supabase is not configured/) });
    expect(parsePublicEnv({ VITE_SUPABASE_URL: "127.0.0.1:54321", VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE })).toEqual({
      ok: false,
      message: expect.stringMatching(/VITE_SUPABASE_URL must be an http\(s\) URL/),
    });
    expect(parsePublicEnv({ VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE })).toEqual({
      ok: true,
      env: { url: "http://127.0.0.1:54321", key: PUBLISHABLE },
    });
  });

  it("rejects a secret key in VITE_SUPABASE_PUBLISHABLE_KEY (existing behavior)", () => {
    const result = parsePublicEnv({ VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_PUBLISHABLE_KEY: SECRET });
    expect(!result.ok && result.message).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY holds a secret key/);
  });

  it("rejects a secret key in any other VITE_ variable", () => {
    const result = parsePublicEnv({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      VITE_SUPABASE_SERVICE_KEY: legacyJwt("service_role"),
    });
    expect(!result.ok && result.message).toMatch(/VITE_SUPABASE_SERVICE_KEY holds a secret key.*SUPABASE_SECRET_KEY/s);
  });
});
