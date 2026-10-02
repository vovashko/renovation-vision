// The auth forms' zod schemas. Messages are i18n keys (`FormField` translates them).
//
// Password rules mirror supabase/config.toml's [auth]: `minimum_password_length = 10` and
// `password_requirements = "letters_digits"`, which gotrue checks against the ASCII sets
// a-z/A-Z and 0-9 (so "ąęółżźćń12" isn't enough: it needs an ASCII letter). They only apply to NEW
// passwords; signing in accepts whatever the account has (the seeded demo password predates them).
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt only reads the first 72 bytes; gotrue rejects longer passwords. */
export const PASSWORD_MAX_LENGTH = 72;
export const TOTP_CODE_LENGTH = 6;

export const emailSchema = z.string().trim().min(1, "common:form.required").email("common:form.invalidEmail");

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "auth:password.tooShort")
  .max(PASSWORD_MAX_LENGTH, "auth:password.tooLong")
  .regex(/[A-Za-z]/, "auth:password.needsLetter")
  .regex(/[0-9]/, "auth:password.needsDigit");

/** A 6-digit code: a TOTP from an authenticator app, or the emailed reauthentication code. */
export const codeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${TOTP_CODE_LENGTH}}$`), "auth:code.invalid");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "common:form.required"),
});

export const emailFormSchema = z.object({ email: emailSchema });

export const newPasswordFormSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((values) => values.password === values.confirm, { path: ["confirm"], message: "auth:password.mismatch" });

export const codeFormSchema = z.object({ code: codeSchema });

export type SignInValues = z.output<typeof signInSchema>;
export type NewPasswordValues = z.output<typeof newPasswordFormSchema>;
