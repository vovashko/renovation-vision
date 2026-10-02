import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";

const BREVO_KEY = ["xkeysib", "not-a-real-key", "abc123"].join("-");

function capturedConsoleLines() {
  const lines: { level: "log" | "warn" | "error"; json: Record<string, unknown> }[] = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void lines.push({ level: "log", json: JSON.parse(line) }));
  vi.spyOn(console, "warn").mockImplementation((line: string) => void lines.push({ level: "warn", json: JSON.parse(line) }));
  vi.spyOn(console, "error").mockImplementation((line: string) => void lines.push({ level: "error", json: JSON.parse(line) }));
  return lines;
}

beforeEach(async () => {
  resetWorkerEnv();
  const { resetEmailProviderWarnings } = await import("@/server/email/providers.server");
  resetEmailProviderWarnings();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resolveEmailProvider", () => {
  it("picks Brevo when BREVO_API_KEY is set, in any environment", async () => {
    const { resolveEmailProvider } = await import("@/server/email/providers.server");
    for (const appEnv of ["development", "test", "preview", "production"] as const) {
      expect(resolveEmailProvider({ brevoApiKey: BREVO_KEY, appEnv, emailSandbox: false }).name).toBe("brevo");
    }
  });

  it("falls back to the log provider in development/test without a Brevo key, warning once", async () => {
    const lines = capturedConsoleLines();
    const { resolveEmailProvider } = await import("@/server/email/providers.server");
    expect(resolveEmailProvider({ brevoApiKey: undefined, appEnv: "development", emailSandbox: false }).name).toBe("log");
    expect(resolveEmailProvider({ brevoApiKey: undefined, appEnv: "test", emailSandbox: false }).name).toBe("log");
    expect(resolveEmailProvider({ brevoApiKey: undefined, appEnv: "development", emailSandbox: false }).name).toBe("log");
    const warnings = lines.filter((l) => l.level === "warn");
    expect(warnings).toHaveLength(1); // one-time, not once per call
  });

  it("requires Brevo in production/preview: throws EMAIL_NOT_CONFIGURED without leaking anything sensitive", async () => {
    const { resolveEmailProvider } = await import("@/server/email/providers.server");
    const { isServerFnError } = await import("@/server/errors");
    for (const appEnv of ["production", "preview"] as const) {
      try {
        resolveEmailProvider({ brevoApiKey: undefined, appEnv, emailSandbox: false });
        expect.unreachable(`should have thrown for ${appEnv}`);
      } catch (error) {
        expect(isServerFnError(error)).toBe(true);
        expect(isServerFnError(error) && error.code).toBe("EMAIL_NOT_CONFIGURED");
      }
    }
  });
});

describe("createBrevoProvider", () => {
  it("POSTs to the Brevo API with the api-key header and the expected JSON body shape", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ messageId: "abc" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createBrevoProvider } = await import("@/server/email/providers.server");

    await createBrevoProvider(BREVO_KEY).send({
      to: "sarah@renovision.demo",
      from: "RenoVision <no-reply@renovision.app>",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["api-key"]).toBe(BREVO_KEY);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      sender: { email: "no-reply@renovision.app", name: "RenoVision" },
      to: [{ email: "sarah@renovision.demo" }],
      subject: "Hello",
      htmlContent: "<p>Hi</p>",
      textContent: "Hi",
    });
    expect(body.headers).toBeUndefined(); // no sandbox option passed -> no sandbox field
  });

  it("adds Brevo's sandbox field (inside the JSON body, not an HTTP header) when sandbox: true", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ messageId: "abc" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createBrevoProvider } = await import("@/server/email/providers.server");

    await createBrevoProvider(BREVO_KEY, { sandbox: true }).send({
      to: "sarah@renovision.demo",
      from: "RenoVision <no-reply@renovision.app>",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.headers).toEqual({ "X-Sib-Sandbox": "drop" });
    // It's a body field, so it must not also be sent as a literal HTTP request header.
    const httpHeaders = init.headers as Record<string, string>;
    expect(httpHeaders["X-Sib-Sandbox"]).toBeUndefined();
  });

  it("omits the sandbox field when sandbox: false (or omitted)", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ messageId: "abc" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createBrevoProvider } = await import("@/server/email/providers.server");

    await createBrevoProvider(BREVO_KEY, { sandbox: false }).send({
      to: "sarah@renovision.demo",
      from: "RenoVision <no-reply@renovision.app>",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.headers).toBeUndefined();
  });

  it("logs a ServerFnError on a non-ok response, without leaking the API key", async () => {
    const lines = capturedConsoleLines();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid api key", { status: 401 })),
    );
    const { createBrevoProvider } = await import("@/server/email/providers.server");
    const { isServerFnError } = await import("@/server/errors");

    const result = await createBrevoProvider(BREVO_KEY)
      .send({ to: "a@b.com", from: "RenoVision <no-reply@renovision.app>", subject: "s", html: "h", text: "t" })
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(isServerFnError(result)).toBe(true);
    expect(isServerFnError(result) && result.code).toBe("INTERNAL");

    const text = lines.map((l) => JSON.stringify(l.json)).join("\n");
    expect(text).not.toContain(BREVO_KEY);
  });

  it("logs a ServerFnError on a network failure, without leaking the API key", async () => {
    const lines = capturedConsoleLines();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const { createBrevoProvider } = await import("@/server/email/providers.server");
    const { isServerFnError } = await import("@/server/errors");

    const result = await createBrevoProvider(BREVO_KEY)
      .send({ to: "a@b.com", from: "RenoVision <no-reply@renovision.app>", subject: "s", html: "h", text: "t" })
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(isServerFnError(result)).toBe(true);
    const text = lines.map((l) => JSON.stringify(l.json)).join("\n");
    expect(text).not.toContain(BREVO_KEY);
  });
});

describe("createLogProvider", () => {
  it("writes the rendered email through the logger, scrubbed", async () => {
    const lines = capturedConsoleLines();
    const { createLogProvider } = await import("@/server/email/providers.server");

    await createLogProvider().send({
      to: "sarah@renovision.demo",
      from: "RenoVision <no-reply@renovision.app>",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi sarah@renovision.demo",
    });

    expect(lines).toHaveLength(1);
    const fields = lines[0].json;
    expect(fields.to).toBe("[email]");
    expect(fields.from).toContain("[email]");
    expect(fields.text).toContain("[email]");
    expect(JSON.stringify(fields)).not.toContain("sarah@renovision.demo");
  });
});

describe("sendEmail", () => {
  it("renders the template and sends it through the resolved provider", async () => {
    resetWorkerEnv({ APP_ENV: "test" });
    const lines = capturedConsoleLines();
    const { sendEmail } = await import("@/server/email/send-email.server");

    await sendEmail({
      to: "sarah@renovision.demo",
      template: "notification",
      locale: "en",
      params: {
        siteUrl: "https://app.renovision.app",
        title: "New photos",
        body: "4 new photos",
        linkUrl: "https://app.renovision.app/projects/1/photos",
      },
    });

    const sentLine = lines.find((l) => l.json.subject === "New photos — RenoVision");
    expect(sentLine).toBeDefined();
  });

  it("throws EMAIL_NOT_CONFIGURED in production without BREVO_API_KEY, and logs it once", async () => {
    resetWorkerEnv({ APP_ENV: "production" });
    const lines = capturedConsoleLines();
    const { sendEmail } = await import("@/server/email/send-email.server");
    const { isServerFnError } = await import("@/server/errors");

    const result = await sendEmail({
      to: "sarah@renovision.demo",
      template: "notification",
      locale: "en",
      params: {
        siteUrl: "https://app.renovision.app",
        title: "New photos",
        body: "4 new photos",
        linkUrl: "https://app.renovision.app/projects/1/photos",
      },
    }).then(
      () => undefined,
      (e: unknown) => e,
    );

    expect(isServerFnError(result)).toBe(true);
    expect(isServerFnError(result) && result.code).toBe("EMAIL_NOT_CONFIGURED");
    expect(lines.filter((l) => l.level === "error")).toHaveLength(1);
  });

  it("adds the Brevo sandbox field when EMAIL_SANDBOX=true", async () => {
    resetWorkerEnv({ APP_ENV: "production", BREVO_API_KEY: BREVO_KEY, EMAIL_SANDBOX: "true" });
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ messageId: "abc" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("@/server/email/send-email.server");

    await sendEmail({
      to: "sarah@renovision.demo",
      template: "notification",
      locale: "en",
      params: {
        siteUrl: "https://app.renovision.app",
        title: "New photos",
        body: "4 new photos",
        linkUrl: "https://app.renovision.app/projects/1/photos",
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.headers).toEqual({ "X-Sib-Sandbox": "drop" });
  });
});
