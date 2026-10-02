import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/locale";
import { renderDigestEmail, type DigestEmailParams } from "@/server/email/templates/digest";
import { renderNotificationEmail, type NotificationEmailParams } from "@/server/email/templates/notification";
import type { EmailContent } from "@/server/email/templates/types";

const SITE_URL = "https://app.renovision.app";

const NOTIFICATION_PARAMS: NotificationEmailParams = {
  siteUrl: SITE_URL,
  title: "New photos",
  body: "4 new photos were added to the kitchen stage.",
  linkUrl: "https://app.renovision.app/projects/1/photos",
  linkLabel: "View photos",
};

const DIGEST_PARAMS: DigestEmailParams = {
  siteUrl: SITE_URL,
  items: [{ title: "Kitchen stage completed", body: "The kitchen stage was marked done." }, { title: "New expense logged" }],
  linkUrl: "https://app.renovision.app/projects/1",
  linkLabel: "Open project",
};

/** No `{{placeholder}}` left unreplaced, and no literal "undefined"/"null" leaking into the output. */
function expectNoUnreplacedPlaceholders(content: EmailContent) {
  for (const value of [content.subject, content.html, content.text]) {
    expect(value).not.toMatch(/\{\{\s*[\w.]+\s*\}\}/);
    expect(value).not.toMatch(/\bundefined\b/);
  }
}

describe("renderNotificationEmail", () => {
  for (const locale of LOCALES) {
    it(`renders in ${locale} with all params, no unreplaced placeholders, and the link in both bodies`, () => {
      const content = renderNotificationEmail(NOTIFICATION_PARAMS, locale);
      expectNoUnreplacedPlaceholders(content);
      expect(content.subject).toContain(NOTIFICATION_PARAMS.title);
      expect(content.html).toContain(NOTIFICATION_PARAMS.linkUrl);
      expect(content.text).toContain(NOTIFICATION_PARAMS.linkUrl);
      expect(content.html).toContain(NOTIFICATION_PARAMS.linkLabel);
      expect(content.text).toContain(NOTIFICATION_PARAMS.linkLabel);
    });
  }

  it("falls back to the translated cta when linkLabel is omitted", () => {
    const { linkLabel: _linkLabel, ...rest } = NOTIFICATION_PARAMS;
    const en = renderNotificationEmail(rest, "en");
    const pl = renderNotificationEmail(rest, "pl");
    expect(en.html).toContain("Open in RenoVision");
    expect(pl.html).toContain("Otwórz w RenoVision");
  });

  it("HTML-escapes user content (a title containing <script> is escaped)", () => {
    const content = renderNotificationEmail({ ...NOTIFICATION_PARAMS, title: '<script>alert("x")</script>' }, "en");
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    // The plain-text version is not HTML, so it carries the raw title unescaped.
    expect(content.text).toContain('<script>alert("x")</script>');
  });

  it("escapes a malicious body too", () => {
    const content = renderNotificationEmail({ ...NOTIFICATION_PARAMS, body: '<img src=x onerror="alert(1)">' }, "en");
    expect(content.html).not.toContain("<img src=x onerror");
    expect(content.html).toContain("&lt;img");
  });
});

describe("renderDigestEmail", () => {
  for (const locale of LOCALES) {
    it(`renders in ${locale} with all params, no unreplaced placeholders, and the link in both bodies`, () => {
      const content = renderDigestEmail(DIGEST_PARAMS, locale);
      expectNoUnreplacedPlaceholders(content);
      expect(content.html).toContain(DIGEST_PARAMS.linkUrl);
      expect(content.text).toContain(DIGEST_PARAMS.linkUrl);
      for (const item of DIGEST_PARAMS.items) {
        expect(content.html).toContain(item.title);
        expect(content.text).toContain(item.title);
      }
    });
  }

  it("shows the translated empty state with no items", () => {
    const content = renderDigestEmail({ siteUrl: SITE_URL, items: [], linkUrl: DIGEST_PARAMS.linkUrl }, "en");
    expectNoUnreplacedPlaceholders(content);
    expect(content.html).toContain("No new activity since your last digest.");
  });

  it("HTML-escapes an item title containing <script>", () => {
    const content = renderDigestEmail(
      { siteUrl: SITE_URL, items: [{ title: '<script>alert("x")</script>' }], linkUrl: DIGEST_PARAMS.linkUrl },
      "en",
    );
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
  });
});

describe("Layout (shared design-system shell)", () => {
  it("builds the header logo's absolute URL from siteUrl", () => {
    const content = renderNotificationEmail(NOTIFICATION_PARAMS, "en");
    expect(content.html).toContain(`src="${SITE_URL}/email-logo.png"`);
  });
});
