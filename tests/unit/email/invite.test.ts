// The "invite" app email (T40): both languages and roles, the link, escaping, and `sensitive` (the link signs in).
import { describe, expect, it } from "vitest";
import { renderEmail } from "@/server/email/templates";

const params = {
  siteUrl: "https://app.renovision.test",
  inviteUrl: "https://app.renovision.test/accept-invite?token_hash=abc123&type=invite",
  inviterName: "Jonas <Weber>",
  projectName: "Maple Street",
  role: "client" as const,
  expiresInDays: 7,
};

describe("invite email", () => {
  it("names the inviter and project, links to /accept-invite and says how long it works", () => {
    const { subject, html, text } = renderEmail("invite", params, "en");
    expect(subject).toBe("Jonas <Weber> invited you to Maple Street on RenoVision");
    expect(html).toContain('href="https://app.renovision.test/accept-invite?token_hash=abc123&amp;type=invite"');
    expect(html).toContain("Jonas &lt;Weber&gt;");
    expect(html).not.toContain("<Weber>");
    expect(text).toContain(params.inviteUrl);
    expect(text).toContain("7 days");
  });

  it("is marked sensitive, so the log provider never prints the link", () => {
    expect(renderEmail("invite", params, "pl").sensitive).toBe(true);
  });

  it("says manage for a manager invite, in Polish too", () => {
    expect(renderEmail("invite", { ...params, role: "manager" }, "en").text).toContain("invited you to manage Maple Street");
    const pl = renderEmail("invite", { ...params, role: "manager" }, "pl");
    expect(pl.text).toContain("zaprasza Cię do zarządzania projektem Maple Street");
    expect(pl.html).toContain('lang="pl"');
  });
});
