import { afterEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";

const EU_DSN = "https://public@o0.ingest.de.sentry.io/0";

// Hoisted spies: vi.mock factories run before any import in this file (including the dynamic
// imports below), so they can't close over plain `const`s declared later — only over `vi.hoisted`
// values (see tests/unit/server/security-headers.test.ts for the same pattern).
const react = vi.hoisted(() => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((fn: (s: unknown) => void) => fn({ setTag: vi.fn() })),
}));
vi.mock("@sentry/react", () => react);

const cloudflare = vi.hoisted(() => ({
  withSentry: vi.fn((_cb: unknown, handler: unknown) => handler),
  setTag: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("@sentry/cloudflare", () => cloudflare);

const { initBrowserSentry } = await import("@/lib/sentry-client");
const { wrapWithSentry, captureServerException } = await import("@/lib/sentry-worker");

afterEach(() => {
  vi.unstubAllEnvs();
  resetWorkerEnv();
  vi.clearAllMocks();
  // initBrowserSentry has its own module-level "already initialized" latch; each test below sets
  // VITE_SENTRY_DSN (or not) and calls it exactly once, so the latch doesn't leak between tests.
});

describe("browser Sentry (src/lib/sentry-client.ts)", () => {
  it("is a no-op without VITE_SENTRY_DSN: no init call", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    initBrowserSentry();
    expect(react.init).not.toHaveBeenCalled();
  });

  it("initializes with sendDefaultPii: false and the EU DSN passed through, given a DSN", () => {
    vi.stubEnv("VITE_SENTRY_DSN", EU_DSN);
    initBrowserSentry();
    expect(react.init).toHaveBeenCalledTimes(1);
    const options = react.init.mock.calls[0][0];
    expect(options.dsn).toBe(EU_DSN);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.release).toBeTruthy();
    expect(typeof options.beforeSend).toBe("function");
  });
});

describe("Worker Sentry (src/lib/sentry-worker.ts)", () => {
  it("is a no-op without SENTRY_DSN: withSentry's options callback returns undefined, capture is a no-op", () => {
    resetWorkerEnv({ APP_ENV: "test" });
    const handler = { fetch: vi.fn() };
    wrapWithSentry(handler, () => undefined);
    expect(cloudflare.withSentry).toHaveBeenCalledTimes(1);
    const optionsCallback = cloudflare.withSentry.mock.calls[0][0] as () => unknown;
    expect(optionsCallback()).toBeUndefined();

    captureServerException(new Error("boom"));
    expect(cloudflare.captureException).not.toHaveBeenCalled();
  });

  it("builds options with sendDefaultPii: false and the EU DSN passed through, given SENTRY_DSN", () => {
    resetWorkerEnv({ APP_ENV: "production", SENTRY_DSN: EU_DSN });
    const handler = { fetch: vi.fn() };
    wrapWithSentry(handler, () => undefined);
    const optionsCallback = cloudflare.withSentry.mock.calls[0][0] as () => { dsn: string; sendDefaultPii: boolean; environment: string };
    const options = optionsCallback();
    expect(options?.dsn).toBe(EU_DSN);
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.environment).toBe("production");

    captureServerException(new Error("boom"));
    expect(cloudflare.captureException).toHaveBeenCalledTimes(1);
  });

  it("hands back the original handler untouched (withSentry's return value)", () => {
    resetWorkerEnv({ APP_ENV: "test" });
    const handler = { fetch: vi.fn() };
    const wrapped = wrapWithSentry(handler, () => undefined);
    expect(wrapped).toBe(handler);
  });
});
