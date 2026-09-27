import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// src/lib/supabase.ts must never throw at import time (that would crash SSR/the
// module graph on a missing config) — only once something actually uses the
// client, so the root route's error boundary can render a readable message.

describe("supabase client, unconfigured", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw on import", async () => {
    await expect(import("@/lib/supabase")).resolves.toBeDefined();
  });

  it("throws a clear, actionable message when the client is used", async () => {
    const { supabase } = await import("@/lib/supabase");
    expect(() => supabase.auth).toThrow(/Supabase is not configured.*VITE_SUPABASE_URL.*VITE_SUPABASE_PUBLISHABLE_KEY/s);
  });
});

describe("supabase client, configured", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a real client that does not throw on access", async () => {
    const { supabase } = await import("@/lib/supabase");
    expect(() => supabase.auth).not.toThrow();
  });
});
