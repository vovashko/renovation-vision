import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubSentryEvent, scrubUser } from "@/lib/sentry-scrub";
import { hashUserId } from "@/lib/pii-scrub";

const JWT = ["eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9", "eyJzdWIiOiJhYmMiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9", "c2lnbmF0dXJl"].join(".");
const USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("scrubSentryEvent", () => {
  it("scrubs emails, phones and JWTs from message, exception values, extra and tags", () => {
    const event = scrubSentryEvent({
      message: "contact jonas@renovision.demo about +48 123 456 789",
      exception: { values: [{ type: "Error", value: `token ${JWT} is invalid` }] },
      extra: { note: "call +48 123 456 789", nested: { email: "a@b.com" } },
      tags: { hint: "jonas@renovision.demo" },
    });
    expect(event.message).toBe("contact [email] about [phone]");
    expect(event.exception?.values?.[0].value).toBe("token [jwt] is invalid");
    expect(event.extra).toEqual({ note: "call [phone]", nested: { email: "[email]" } });
    expect(event.tags).toEqual({ hint: "[email]" });
  });

  it("scrubs breadcrumbs (message and data)", () => {
    const event = scrubSentryEvent({
      breadcrumbs: [{ message: "emailed sarah@renovision.demo", data: { to: "sarah@renovision.demo" } }],
    });
    expect(event.breadcrumbs?.[0].message).toBe("emailed [email]");
    expect(event.breadcrumbs?.[0].data).toEqual({ to: "[email]" });
  });

  it("drops cookies entirely and redacts the authorization header; scrubs other headers/fields", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.example/projects/1",
        cookies: { "sb-ref-auth-token": "super-secret-session" },
        headers: { Authorization: "Bearer abc.def.ghi", Cookie: "sb-ref-auth-token=x", "User-Agent": "contact jonas@renovision.demo" },
      },
    });
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request?.headers?.Authorization).toBe("[redacted]");
    expect(event.request?.headers?.Cookie).toBe("[redacted]");
    expect(event.request?.headers?.["User-Agent"]).toBe("contact [email]");
    expect(JSON.stringify(event)).not.toContain("super-secret-session");
    expect(JSON.stringify(event)).not.toContain("abc.def.ghi");
  });

  it("reduces the user to the hashed id only — never the email, username or ip", () => {
    const event = scrubSentryEvent({ user: { id: USER_ID, email: "jonas@renovision.demo", username: "jonas", ip_address: "1.2.3.4" } });
    expect(event.user).toEqual({ id: hashUserId(USER_ID) });
    expect(JSON.stringify(event)).not.toContain("jonas@renovision.demo");
    expect(JSON.stringify(event)).not.toContain("1.2.3.4");
  });

  it("drops the user entirely when there's no id", () => {
    expect(scrubSentryEvent({ user: { email: "jonas@renovision.demo" } }).user).toBeUndefined();
    expect(scrubSentryEvent({ user: undefined }).user).toBeUndefined();
    expect(scrubSentryEvent({}).user).toBeUndefined();
  });

  it("redacts password/secret/token-like extra fields, matching the logger's rules", () => {
    const event = scrubSentryEvent({ extra: { password: "hunter2", apiKey: "sb_secret_x", count: 3 } });
    expect(event.extra).toEqual({ password: "[redacted]", apiKey: "[redacted]", count: 3 });
  });
});

describe("scrubUser", () => {
  it("hashes a numeric or string id the same way", () => {
    expect(scrubUser({ id: USER_ID })).toEqual({ id: hashUserId(USER_ID) });
    expect(scrubUser({ id: 42 })).toEqual({ id: hashUserId("42") });
  });
});

describe("scrubBreadcrumb", () => {
  it("scrubs a lone breadcrumb's message and data", () => {
    const crumb = scrubBreadcrumb({ message: "called +48 123 456 789", data: { value: JWT } });
    expect(crumb.message).toBe("called [phone]");
    expect(crumb.data).toEqual({ value: "[jwt]" });
  });

  it("redacts a sensitive-named data field entirely, same as the logger", () => {
    const crumb = scrubBreadcrumb({ message: "ok", data: { token: JWT } });
    expect(crumb.data).toEqual({ token: "[redacted]" });
  });
});
