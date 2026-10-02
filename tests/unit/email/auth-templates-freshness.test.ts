// Fails if supabase/templates/*.html is out of date with the generator (scripts/
// build-auth-email-templates.ts) and the design-system components/copy it's built from: regenerates
// every template in memory and byte-for-byte compares it against the checked-in file. There should
// never be a reason to hand-edit those files directly — change the copy (design/auth-copy.ts) or the
// components (design/components.ts) and run `bun run email:build`.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTH_EMAIL_TYPES, generateAuthTemplate, TEMPLATES_DIR } from "../../../scripts/build-auth-email-templates";

describe.each(AUTH_EMAIL_TYPES)("supabase/templates/%s.html is up to date", (type) => {
  it("matches what the generator produces right now", () => {
    const filePath = path.join(TEMPLATES_DIR, `${type}.html`);
    const onDisk = fs.readFileSync(filePath, "utf8");
    const regenerated = generateAuthTemplate(type);
    expect(onDisk, `supabase/templates/${type}.html is stale — run \`bun run email:build\``).toBe(regenerated);
  });
});
