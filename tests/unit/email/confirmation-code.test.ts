import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALES } from "@/i18n/locale";
import { renderEmail } from "@/server/email/templates";
import { renderConfirmationCodeEmail } from "@/server/email/templates/confirmation-code";

const PARAMS = { siteUrl: "https://app.renovision.app", title: "Extra socket", code: "482913", ttlMinutes: 10 };

afterEach(() => vi.restoreAllMocks());

describe("confirmationCode email", () => {
  it.each(LOCALES)("renders in %s with the code, the case title and the validity, nothing left unreplaced", (locale) => {
    const mail = renderConfirmationCodeEmail(PARAMS, locale);
    for (const value of [mail.subject, mail.html, mail.text]) {
      expect(value).not.toMatch(/\{\{\s*[\w.]+\s*\}\}/);
      expect(value).not.toMatch(/\bundefined\b/);
    }
    expect(mail.text).toContain("482913");
    expect(mail.text).toContain("Extra socket");
    expect(mail.text).toContain("10");
    expect(mail.html).toContain("4 8 2 9 1 3");
    expect(mail.subject).not.toContain("482913"); // the code never goes in the subject line
  });

  it("is Polish in pl and English in en", () => {
    expect(renderConfirmationCodeEmail(PARAMS, "pl").subject).toBe("Twój kod potwierdzenia — RenoVision");
    expect(renderConfirmationCodeEmail(PARAMS, "en").subject).toBe("Your confirmation code — RenoVision");
  });

  it("escapes the case title", () => {
    const mail = renderConfirmationCodeEmail({ ...PARAMS, title: "<script>alert(1)</script>" }, "en");
    expect(mail.html).not.toContain("<script>alert(1)</script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("is marked sensitive and registered with the template registry", () => {
    expect(renderEmail("confirmationCode", PARAMS, "en").sensitive).toBe(true);
  });
});

describe("the log provider and sensitive emails", () => {
  it("never writes a sensitive email's text (the code) to the logs, but still logs an ordinary one", async () => {
    const lines: string[] = [];
    for (const level of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
    }
    const { createLogProvider } = await import("@/server/email/providers.server");
    const base = { to: "sarah@renovision.demo", from: "RenoVision <no-reply@renovision.app>", subject: "s", html: "<p>h</p>" };

    await createLogProvider().send({ ...base, text: "Your code is 482913", sensitive: true });
    expect(lines.join("\n")).not.toContain("482913");

    await createLogProvider().send({ ...base, text: "Hello there" });
    expect(lines.join("\n")).toContain("Hello there");
  });
});
