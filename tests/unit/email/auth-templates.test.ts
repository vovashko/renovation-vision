// Supabase Auth's own email templates (supabase/templates/*.html, wired via supabase/config.toml
// [auth.email.template.*]) — not sent by our app, but ours to keep correct: every configured type
// has a template file with both locale branches and the right gotrue variables, and balanced
// {{ if }}/{{ end }} tags. See README -> Email and the gotrue mailer (supabase/auth v2.197.0,
// internal/mailer/templatemailer/templatemailer.go) for the variable names.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../supabase");

// type -> which gotrue template variable it must reference (ConfirmationURL for link-based flows,
// Token for the code-only reauthentication email).
const TEMPLATES: Record<string, "ConfirmationURL" | "Token"> = {
  confirmation: "ConfirmationURL",
  invite: "ConfirmationURL",
  recovery: "ConfirmationURL",
  magic_link: "ConfirmationURL",
  email_change: "ConfirmationURL",
  reauthentication: "Token",
};

function readConfigToml(): string {
  return fs.readFileSync(path.join(ROOT, "config.toml"), "utf8");
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("supabase/config.toml auth.email.template", () => {
  const config = readConfigToml();

  it("configures every template type with a subject and a content_path", () => {
    for (const type of Object.keys(TEMPLATES)) {
      expect(config, type).toMatch(new RegExp(`\\[auth\\.email\\.template\\.${type}\\]`));
    }
  });

  it("keeps [local_smtp] enabled (the local mail catcher)", () => {
    expect(config).toMatch(/\[local_smtp\][^[]*enabled\s*=\s*true/);
  });
});

describe.each(Object.entries(TEMPLATES))("supabase/templates/%s.html", (type, variable) => {
  const filePath = path.join(ROOT, "templates", `${type}.html`);

  it("exists", () => {
    expect(fs.existsSync(filePath), filePath).toBe(true);
  });

  it("is referenced from config.toml's content_path for this type", () => {
    const config = readConfigToml();
    const section = new RegExp(`\\[auth\\.email\\.template\\.${type}\\][\\s\\S]*?content_path\\s*=\\s*"([^"]+)"`).exec(config);
    expect(section, `no content_path for ${type}`).toBeTruthy();
    // The CLI resolves content_path from the repo root (where `supabase start` runs), not from supabase/.
    expect(path.resolve(ROOT, "..", section![1])).toBe(filePath);
  });

  it("contains both the pl and en branches (Data.locale check)", () => {
    const html = fs.readFileSync(filePath, "utf8");
    expect(html).toMatch(/\{\{\s*if\s+eq\s+\.Data\.locale\s+"en"\s*\}\}/);
    expect(html).toMatch(/\{\{\s*else\s*\}\}/);
  });

  it(`references .${variable}`, () => {
    const html = fs.readFileSync(filePath, "utf8");
    expect(html).toContain(`{{ .${variable} }}`);
  });

  it("has balanced {{ if }} / {{ end }} tags", () => {
    const html = fs.readFileSync(filePath, "utf8");
    const ifs = countOccurrences(html, "{{ if ");
    const ends = countOccurrences(html, "{{ end }}");
    expect(ifs).toBeGreaterThan(0);
    expect(ifs).toBe(ends);
  });

  it("has a non-empty subject for both locales in config.toml", () => {
    const config = readConfigToml();
    const section = new RegExp(`\\[auth\\.email\\.template\\.${type}\\][\\s\\S]*?subject\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(config);
    expect(section, `no subject for ${type}`).toBeTruthy();
    const subject = section![1].replace(/\\"/g, '"');
    expect(subject).toMatch(/if eq \.Data\.locale "en"/);
    expect(subject.length).toBeGreaterThan(0);
  });
});
