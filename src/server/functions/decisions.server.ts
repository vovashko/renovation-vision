// Handler bodies for the investor-decision server functions (functions/decisions.ts), split out so they
// are directly unit-testable (the me.server.ts / media.server.ts pattern). README → Server functions &
// security, and src/features/decisions/README.md → "Accepting a case: the confirmation code".
//
// The code design in one paragraph: the server generates a 6-digit code, stores only
// sha256(salt || ":" || code) (+ the salt, an expiry and an attempts counter) with the ADMIN client, and emails
// the code to the signed-in investor. The browser can't write `decision_confirmations`, so it can't plant a
// code it knows. Accepting is `public.accept_decision(decision, code)`, called as the user: the DATABASE checks
// the code (owner, 10 minutes, 5 attempts, single use) under a row lock and applies the totals in the same
// transaction, so the RPC is useless without the emailed code even when called straight from the browser.
// Codes are never logged (the confirmation email is `sensitive`, so not even the dev log provider prints it).
import { getRequestUrl } from "@tanstack/react-start/server";
import { logger } from "@/lib/logger";
import { getAdminSupabase } from "@/lib/supabase/admin";
import en from "@/features/comms/i18n/en.json";
import pl from "@/features/comms/i18n/pl.json";
import type { Locale } from "@/i18n/locale";
import { ServerFnError } from "../errors";
import { sendEmail } from "../email/send-email.server";
import { interpolate } from "../email/html";
import type { AuthContext } from "../middleware/auth";

export const CODE_TTL_MINUTES = 10;
const CODE_LENGTH = 6;

/** A uniformly random 6-digit code (rejection sampling, so no modulo bias). */
export function generateCode(): string {
  const range = 10 ** CODE_LENGTH;
  const limit = 2 ** 32 - (2 ** 32 % range);
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return String(buffer[0] % range).padStart(CODE_LENGTH, "0");
  }
}

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

/** A random per-row salt (16 bytes, hex). */
export function generateSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** sha256(salt || ":" || code) as hex: byte-for-byte what `accept_decision` computes in SQL. */
export async function hashCode(salt: string, code: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${code}`)));
}

/** The app's public origin for links in emails: the origin of the (CSRF-checked, same-origin) request. */
export function requestOrigin(): string {
  return getRequestUrl().origin;
}

export type AcceptResult = "ok" | "already_accepted" | "not_open" | "no_code" | "expired" | "invalid_code" | "too_many_attempts";

type PgError = { code?: string; hint?: string | null; message: string };

/** Turns a Postgres error from one of the decision RPCs into a ServerFnError with a stable `reason`. */
export function decisionRpcError(error: PgError): Error {
  const hint = error.hint ?? undefined;
  if (error.code === "42501") return new ServerFnError("FORBIDDEN", "You can't do this on this project", { reason: "decision_forbidden" });
  if (error.code === "22023" || error.code === "55000" || error.code === "23514") {
    return new ServerFnError("BAD_REQUEST", error.message, { reason: hint ?? "decision_invalid" });
  }
  return new Error(error.message);
}

const localeOf = (value: unknown): Locale => (value === "en" ? "en" : "pl");

export type CreateDecisionInput = {
  projectId: string;
  title: string;
  description: string;
  costDelta: number;
  daysDelta: number;
  photos: string[];
};

/** Submits a case as the manager (RPC), then tells the project's investors by email (best effort). */
export async function createDecisionHandler(data: CreateDecisionInput, context: AuthContext): Promise<{ id: string }> {
  const { data: id, error } = await context.supabase.rpc("create_decision", {
    p_project: data.projectId,
    p_title: data.title,
    p_description: data.description,
    p_cost_delta: data.costDelta,
    p_days_delta: data.daysDelta,
    p_photos: data.photos,
  });
  if (error) throw decisionRpcError(error);

  // The case is saved either way: a failed email must not undo it (the in-app notification is already written).
  try {
    await emailInvestors({ projectId: data.projectId, title: data.title, siteUrl: requestOrigin() });
  } catch (e) {
    logger.error("decision submitted but the investor email failed", { projectId: data.projectId, decisionId: id, err: e });
  }
  return { id };
}

async function emailInvestors(args: { projectId: string; title: string; siteUrl: string }): Promise<void> {
  const admin = getAdminSupabase();
  const { data: members, error } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", args.projectId)
    .eq("role", "client");
  if (error) throw error;
  const linkUrl = `${args.siteUrl}/projects/${args.projectId}/decisions`;
  await Promise.allSettled(
    (members ?? []).map(async (m) => {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(m.user_id);
      const to = userData?.user?.email;
      if (userError || !to) return;
      const { data: profile } = await admin.from("profiles").select("locale").eq("id", m.user_id).maybeSingle();
      const locale = localeOf(profile?.locale);
      const s = (locale === "en" ? en : pl).email.decisionNew;
      await sendEmail({
        to,
        template: "notification",
        locale,
        params: {
          siteUrl: args.siteUrl,
          title: interpolate(s.title, { title: args.title }),
          body: interpolate(s.body, { title: args.title }),
          linkUrl,
          linkLabel: s.cta,
        },
      });
    }),
  );
}

/** Issues a confirmation code for accepting a case and emails it to the signed-in investor. */
export async function requestDecisionCodeHandler(
  data: { projectId: string; decisionId: string },
  context: AuthContext,
): Promise<{ ok: true; expiresInMinutes: number }> {
  // Read as the user: RLS says whether they may see the case at all.
  const { data: decision, error } = await context.supabase
    .from("decisions")
    .select("id, title, status")
    .eq("id", data.decisionId)
    .eq("project_id", data.projectId)
    .maybeSingle();
  if (error) throw error;
  if (!decision) throw new ServerFnError("NOT_FOUND", "Decision not found");
  if (decision.status !== "pending" && decision.status !== "question") {
    throw new ServerFnError("BAD_REQUEST", "This case is no longer open", { reason: "decision_not_open" });
  }
  const email = context.user.email;
  if (!email) throw new ServerFnError("BAD_REQUEST", "Your account has no email address", { reason: "no_email" });

  const code = generateCode();
  const salt = generateSalt();
  const admin = getAdminSupabase();
  const { data: row, error: insertError } = await admin
    .from("decision_confirmations")
    .insert({
      decision_id: decision.id,
      user_id: context.user.id,
      code_hash: await hashCode(salt, code),
      salt,
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (insertError) {
    // 54000 from the DB trigger: five codes for this case and user within an hour.
    if (insertError.code === "54000") {
      throw new ServerFnError("RATE_LIMITED", "Too many codes requested for this case. Try again later.", {
        reason: "too_many_codes",
        retryAfter: 600,
      });
    }
    throw insertError;
  }

  const { data: profile } = await context.supabase.from("profiles").select("locale").eq("id", context.user.id).maybeSingle();
  try {
    await sendEmail({
      to: email,
      template: "confirmationCode",
      locale: localeOf(profile?.locale),
      params: { siteUrl: requestOrigin(), title: decision.title, code, ttlMinutes: CODE_TTL_MINUTES },
    });
  } catch (e) {
    // Nobody received this code: void it so it can't count against the hourly cap's usefulness.
    await admin.from("decision_confirmations").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    throw e;
  }
  return { ok: true, expiresInMinutes: CODE_TTL_MINUTES };
}

/** Accepts a case with the emailed code: the database verifies the code and applies the totals. */
export async function acceptDecisionHandler(
  data: { projectId: string; decisionId: string; code: string },
  context: AuthContext,
): Promise<{ result: AcceptResult }> {
  const { data: result, error } = await context.supabase.rpc("accept_decision", { p_decision: data.decisionId, p_code: data.code });
  if (error) throw decisionRpcError(error);
  return { result: result as AcceptResult };
}
