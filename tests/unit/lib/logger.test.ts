import { afterEach, describe, expect, it } from "vitest";
import { createLogger, hashUserId, scrubString, setLogContextProvider, type LogLevel } from "@/lib/logger";
import { sha256Hex } from "@/lib/sha256";

function capture(level: LogLevel = "debug") {
  const lines: { level: LogLevel; json: Record<string, unknown> }[] = [];
  const log = createLogger({ level, sink: (lvl, line) => lines.push({ level: lvl, json: JSON.parse(line) }), now: () => new Date("2026-09-30T12:00:00.000Z") });
  return { log, lines };
}

// Built at runtime so secret scanners don't flag the fixture.
const JWT = ["eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9", "eyJzdWIiOiJhYmMiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9", "c2lnbmF0dXJl"].join(".");
const USER_ID = "a0000000-0000-4000-8000-000000000001";

afterEach(() => setLogContextProvider(() => undefined));

describe("sha256Hex", () => {
  it("matches the standard test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
});

describe("logger", () => {
  it("writes one JSON line with level, msg, time and the extra fields", () => {
    const { log, lines } = capture();
    log.info("project loaded", { projectId: "p1", count: 3 });
    expect(lines).toEqual([
      { level: "info", json: { level: "info", msg: "project loaded", time: "2026-09-30T12:00:00.000Z", projectId: "p1", count: 3 } },
    ]);
  });

  it("drops lines below the minimum level", () => {
    const { log, lines } = capture("warn");
    log.debug("noise");
    log.info("noise");
    log.warn("kept");
    log.error("kept too");
    expect(lines.map((l) => l.level)).toEqual(["warn", "error"]);
  });

  it("child() adds bindings, and the request context comes first", () => {
    setLogContextProvider(() => ({ requestId: "req-1", route: "/_serverFn/abc" }));
    const { log, lines } = capture();
    log.child({ fn: "getMe" }).info("ok", { durationMs: 4 });
    expect(Object.keys(lines[0].json)).toEqual(["level", "msg", "time", "requestId", "route", "fn", "durationMs"]);
    expect(lines[0].json).toMatchObject({ requestId: "req-1", route: "/_serverFn/abc", fn: "getMe", durationMs: 4 });
  });

  it("hashes userId, from context or fields, to a short stable SHA-256 prefix", () => {
    setLogContextProvider(() => ({ userId: USER_ID }));
    const { log, lines } = capture();
    log.info("from context");
    log.info("from fields", { userId: "someone-else" });
    expect(lines[0].json.userId).toBe(`u_${sha256Hex(USER_ID).slice(0, 12)}`);
    expect(lines[0].json.userId).toBe(hashUserId(USER_ID));
    expect(lines[1].json.userId).toBe(hashUserId("someone-else"));
    expect(JSON.stringify(lines)).not.toContain(USER_ID);
  });

  it("scrubs emails, phone numbers and JWTs in the message and in nested fields", () => {
    const { log, lines } = capture();
    log.warn(`sign-in failed for jonas@renovision.demo with ${JWT}`, {
      contact: { phone: "+48 600 700 800", alt: "(555) 123-4567", emails: ["sarah@renovision.demo"] },
      header: `Bearer ${JWT}`,
      note: "call 600-700-800 or mail a.b+c@example.co.uk",
    });
    const json = lines[0].json;
    expect(json.msg).toBe("sign-in failed for [email] with [jwt]");
    expect(json.contact).toEqual({ phone: "[phone]", alt: "[phone]", emails: ["[email]"] });
    expect(json.header).toBe("Bearer [redacted]");
    expect(json.note).toBe("call [phone] or mail [email]");
    const raw = JSON.stringify(lines);
    expect(raw).not.toMatch(/renovision\.demo|eyJ|600 700 800/);
  });

  it("redacts sensitive keys and Supabase keys", () => {
    const { log, lines } = capture();
    const secret = ["sb", "secret", "abc123"].join("_");
    log.info("config", { password: "hunter2", accessToken: "abc", authorization: "Basic xyz", apiKeyPresent: true, detail: `key=${secret}` });
    expect(lines[0].json).toMatchObject({ password: "[redacted]", accessToken: "[redacted]", authorization: "[redacted]", apiKeyPresent: true, detail: "key=[supabase-key]" });
  });

  it("leaves ids, dates, IPs and plain numbers alone", () => {
    expect(scrubString(`user ${USER_ID} at 2026-09-30T12:00:00.000Z from 127.0.0.1, 42 rows in 1234 ms`)).toBe(
      `user ${USER_ID} at 2026-09-30T12:00:00.000Z from 127.0.0.1, 42 rows in 1234 ms`,
    );
  });

  it("serializes an Error message under err, scrubbed", () => {
    const { log, lines } = capture();
    log.error(new Error("no profile for jonas@renovision.demo"));
    expect(lines[0].json.msg).toBe("no profile for [email]");
    expect(lines[0].json.err).toMatchObject({ name: "Error", message: "no profile for [email]" });
    expect(String((lines[0].json.err as { stack: string }).stack)).not.toContain("jonas@");
  });

  it("survives circular fields", () => {
    const { log, lines } = capture();
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    log.info("loop", { loop });
    expect(lines[0].json.loop).toEqual({ a: 1, self: "[circular]" });
  });
});
