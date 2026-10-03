import { describe, expect, it } from "vitest";
import { codeSchema, emailSchema, newPasswordFormSchema, newPasswordSchema, signInSchema } from "@/features/auth/domain/schemas";

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);

describe("auth schemas", () => {
  it("email: required, valid, trimmed", () => {
    expect(emailSchema.parse("  jonas@renovision.demo ")).toBe("jonas@renovision.demo");
    expect(messages(emailSchema.safeParse(""))).toContain("common:form.required");
    expect(messages(emailSchema.safeParse("not-an-email"))).toContain("common:form.invalidEmail");
  });

  it("new password: 10+ characters with an ASCII letter and a digit (config.toml's letters_digits)", () => {
    expect(newPasswordSchema.safeParse("renovation42").success).toBe(true);
    expect(messages(newPasswordSchema.safeParse("abc123"))).toContain("auth:password.tooShort");
    expect(messages(newPasswordSchema.safeParse("renovision-demo"))).toEqual(["auth:password.needsDigit"]);
    expect(messages(newPasswordSchema.safeParse("1234567890"))).toEqual(["auth:password.needsLetter"]);
    // gotrue only counts a-z/A-Z as letters
    expect(messages(newPasswordSchema.safeParse("ąęółżźćń12"))).toEqual(["auth:password.needsLetter"]);
    expect(messages(newPasswordSchema.safeParse(`a1${"x".repeat(71)}`))).toContain("auth:password.tooLong");
  });

  it("new password form: the repeat must match", () => {
    expect(newPasswordFormSchema.safeParse({ password: "renovation42", confirm: "renovation42" }).success).toBe(true);
    const mismatch = newPasswordFormSchema.safeParse({ password: "renovation42", confirm: "renovation43" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]).toMatchObject({ path: ["confirm"], message: "auth:password.mismatch" });
  });

  it("sign-in accepts any non-empty password (the rules only apply to new passwords)", () => {
    expect(signInSchema.safeParse({ email: "sarah@renovision.demo", password: "renovision-demo-2026" }).success).toBe(true);
    expect(messages(signInSchema.safeParse({ email: "sarah@renovision.demo", password: "" }))).toContain("common:form.required");
  });

  it("TOTP / emailed code: exactly 6 digits", () => {
    expect(codeSchema.safeParse("012345").success).toBe(true);
    expect(codeSchema.parse(" 123456 ")).toBe("123456");
    for (const bad of ["12345", "1234567", "12a456", ""]) expect(messages(codeSchema.safeParse(bad))).toEqual(["auth:code.invalid"]);
  });
});
