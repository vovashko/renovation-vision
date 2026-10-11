// scripts/push-auth-config.ts pushes the hosted project's auth config (Management API, PATCH
// /v1/projects/{ref}/config/auth) with a deliberately narrow payload — see README -> Email ->
// Hosted setup checklist. These tests exercise its pure helpers directly; nothing here calls
// `fetch` or touches the real Management API or Brevo.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_PAYLOAD_KEYS,
  buildPayload,
  extractSubject,
  maskPayload,
  readConfigToml,
  readTemplateContent,
  resolveVars,
  sanitizeEnvValue,
  TEMPLATE_TYPES,
  type ResolvedVars,
} from "../../../scripts/push-auth-config";

const FAKE_VARS: ResolvedVars = {
  supabaseAccessToken: "sbp_fake_access_token_0000000000000000",
  projectRef: "fakerefabcdefg",
  origin: "https://renovision-preview.example.workers.dev",
  brevoSmtpLogin: "fake-login@example.com",
  brevoSmtpKey: "fake-smtp-key-0000000000000000",
  emailFrom: "RenoVision <no-reply@renovision.app>",
};

function realTemplates(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const type of TEMPLATE_TYPES) out[type] = readTemplateContent(type);
  return out;
}

describe("extractSubject", () => {
  const config = readConfigToml();

  it("reads the configured subject for every template type and matches config.toml verbatim (unescaped)", () => {
    for (const type of TEMPLATE_TYPES) {
      const subject = extractSubject(config, type);
      expect(subject.length).toBeGreaterThan(0);
      // The TOML source always escapes the literal quotes around "en"/"pl" in the Go template condition.
      expect(subject).toContain(`.Data.locale "en"`);
    }
  });

  it("throws a clear error for a type with no configured subject", () => {
    expect(() => extractSubject("# no templates here", "confirmation")).toThrow(/no subject/);
  });
});

describe("readTemplateContent", () => {
  it("reads every template file byte for byte, matching the checked-in file on disk", () => {
    for (const type of TEMPLATE_TYPES) {
      const viaHelper = readTemplateContent(type);
      const viaFs = fs.readFileSync(path.resolve(__dirname, "../../../supabase/templates", `${type}.html`), "utf8");
      expect(viaHelper).toBe(viaFs);
    }
  });
});

describe("buildPayload", () => {
  const config = readConfigToml();
  const payload = buildPayload(FAKE_VARS, config, realTemplates() as Record<(typeof TEMPLATE_TYPES)[number], string>);

  it("contains only the allow-listed keys", () => {
    expect(Object.keys(payload).sort()).toEqual([...ALLOWED_PAYLOAD_KEYS].sort());
  });

  it("sends site_url and a redirect allow-list scoped to that environment's origin", () => {
    expect(payload.site_url).toBe(FAKE_VARS.origin);
    expect(payload.uri_allow_list).toBe(`${FAKE_VARS.origin}/**`);
  });

  it("sends Brevo SMTP settings on port 587, with the login/key from env and no hardcoded credential", () => {
    expect(payload.smtp_host).toBe("smtp-relay.brevo.com");
    expect(payload.smtp_port).toBe("587");
    expect(payload.smtp_user).toBe(FAKE_VARS.brevoSmtpLogin);
    expect(payload.smtp_pass).toBe(FAKE_VARS.brevoSmtpKey);
    expect(payload.smtp_sender_name).toBe("RenoVision");
    expect(payload.smtp_admin_email).toBe("no-reply@renovision.app");
  });

  it("every subject matches config.toml and every template matches the file on disk, byte for byte", () => {
    for (const type of TEMPLATE_TYPES) {
      expect(payload[`mailer_subjects_${type}`]).toBe(extractSubject(config, type));
      expect(payload[`mailer_templates_${type}_content`]).toBe(readTemplateContent(type));
    }
  });
});

describe("resolveVars", () => {
  const FULL_SOURCE: Record<string, string> = {
    SUPABASE_ACCESS_TOKEN: FAKE_VARS.supabaseAccessToken,
    SUPABASE_PROJECT_REF_PREVIEW: FAKE_VARS.projectRef,
    APP_ORIGIN_PREVIEW: FAKE_VARS.origin,
    BREVO_SMTP_LOGIN: FAKE_VARS.brevoSmtpLogin,
    BREVO_SMTP_KEY: FAKE_VARS.brevoSmtpKey,
    EMAIL_FROM: FAKE_VARS.emailFrom,
  };

  it("resolves every value for a complete environment", () => {
    const result = resolveVars("preview", FULL_SOURCE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.vars).toEqual(FAKE_VARS);
  });

  it("picks the --env-specific project ref and origin variable names", () => {
    const prodSource: Record<string, string> = {
      ...FULL_SOURCE,
      SUPABASE_PROJECT_REF_PREVIEW: "",
      SUPABASE_PROJECT_REF_PRODUCTION: "prodref0000000",
      APP_ORIGIN_PREVIEW: "",
      APP_ORIGIN_PRODUCTION: "https://app.renovision.app",
    };
    const result = resolveVars("production", prodSource);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vars.projectRef).toBe("prodref0000000");
      expect(result.vars.origin).toBe("https://app.renovision.app");
    }
  });

  it("fails with a sanitized error listing missing variable names, never a secret value", () => {
    const partial = { ...FULL_SOURCE };
    delete partial.SUPABASE_ACCESS_TOKEN;
    delete partial.BREVO_SMTP_KEY;
    const result = resolveVars("preview", partial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("SUPABASE_ACCESS_TOKEN");
      expect(result.message).toContain("BREVO_SMTP_KEY");
      // The present secret (BREVO_SMTP_LOGIN) must never appear in full in the message.
      expect(result.message).not.toContain(FAKE_VARS.brevoSmtpLogin);
      // Non-secret present values (the origin) are fine to show in full.
      expect(result.message).not.toContain(FAKE_VARS.supabaseAccessToken);
      expect(result.message).not.toContain(FAKE_VARS.brevoSmtpKey);
    }
  });

  it("treats a blank-string value the same as missing", () => {
    const result = resolveVars("preview", { ...FULL_SOURCE, EMAIL_FROM: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("EMAIL_FROM");
  });

  it("rejects an origin with a path or trailing slash", () => {
    const result = resolveVars("preview", { ...FULL_SOURCE, APP_ORIGIN_PREVIEW: "https://app.renovision.app/" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("APP_ORIGIN_PREVIEW");
  });
});

describe("sanitizeEnvValue", () => {
  it("masks a secret-ish variable to a short prefix plus a length, never the full value", () => {
    const sanitized = sanitizeEnvValue("BREVO_SMTP_KEY", "super-secret-value-123456");
    expect(sanitized).not.toContain("super-secret-value-123456");
    expect(sanitized).toMatch(/\(\d+ chars\)/);
  });

  it("leaves a non-secret variable (e.g. an origin) unchanged", () => {
    expect(sanitizeEnvValue("APP_ORIGIN_PREVIEW", "https://app.renovision.app")).toBe("https://app.renovision.app");
  });
});

describe("maskPayload (--dry-run)", () => {
  it("masks smtp_pass and smtp_user, leaving every other field (including templates and subjects) intact", () => {
    const config = readConfigToml();
    const payload = buildPayload(FAKE_VARS, config, realTemplates() as Record<(typeof TEMPLATE_TYPES)[number], string>);
    const masked = maskPayload(payload);

    expect(masked.smtp_pass).not.toBe(payload.smtp_pass);
    expect(masked.smtp_pass).not.toContain(FAKE_VARS.brevoSmtpKey);
    expect(masked.smtp_user).not.toBe(payload.smtp_user);
    expect(masked.smtp_user).not.toContain(FAKE_VARS.brevoSmtpLogin);

    expect(masked.site_url).toBe(payload.site_url);
    expect(masked.smtp_sender_name).toBe(payload.smtp_sender_name);
    for (const type of TEMPLATE_TYPES) {
      expect(masked[`mailer_templates_${type}_content`]).toBe(payload[`mailer_templates_${type}_content`]);
      expect(masked[`mailer_subjects_${type}`]).toBe(payload[`mailer_subjects_${type}`]);
    }
  });
});
