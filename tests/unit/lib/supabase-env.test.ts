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

// Values that are present but wrong must not reach supabase-js (whose "Invalid supabaseUrl" error
// doesn't say which variable to fix): each gets a message naming the variable and the format.
describe("supabase client, misconfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function clientWith(url: string, key: string) {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", url);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const { supabase } = await import("@/lib/supabase");
    return supabase;
  }

  it("names VITE_SUPABASE_URL and the expected format when the URL has no http(s):// scheme", async () => {
    const supabase = await clientWith("127.0.0.1:54321", "sb_publishable_abc");
    expect(() => supabase.auth).toThrow(
      /VITE_SUPABASE_URL must be an http\(s\) URL such as http:\/\/127\.0\.0\.1:54321.*"127\.0\.0\.1:54321".*README → Local Supabase/s,
    );
  });

  it("rejects a non-http scheme", async () => {
    const supabase = await clientWith("ftp://example.com", "sb_publishable_abc");
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_URL must be an http\(s\) URL/);
  });

  it("names VITE_SUPABASE_PUBLISHABLE_KEY when the key is empty", async () => {
    const supabase = await clientWith("http://127.0.0.1:54321", "   ");
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY is empty.*sb_publishable_.*README → Local Supabase/s);
  });

  it("names VITE_SUPABASE_URL when only the URL is missing", async () => {
    const supabase = await clientWith("", "sb_publishable_abc");
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_URL is empty/);
  });

  it("refuses a secret key (sb_secret_…), which would ship to the browser", async () => {
    // Built at runtime so secret scanners don't mistake the fixture for a real key.
    const supabase = await clientWith("http://127.0.0.1:54321", ["sb", "secret", "not-a-real-key"].join("_"));
    expect(() => supabase.auth).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY holds a secret key.*publishable key.*README → Local Supabase/s);
  });

  it("refuses a legacy service_role JWT", async () => {
    const payload = btoa(JSON.stringify({ iss: "supabase-demo", role: "service_role" })).replace(/=+$/, "");
    const supabase = await clientWith("http://127.0.0.1:54321", `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`);
    expect(() => supabase.auth).toThrow(/holds a secret key/);
  });

  it("accepts a legacy anon JWT and an https URL", async () => {
    const payload = btoa(JSON.stringify({ iss: "supabase-demo", role: "anon" })).replace(/=+$/, "");
    const supabase = await clientWith("https://abc.supabase.co", `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`);
    expect(() => supabase.auth).not.toThrow();
  });
});
