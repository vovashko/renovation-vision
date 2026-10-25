// Handler bodies for the change-request server functions (functions/decisions.ts), split out so they are directly
// unit-testable (the me.server.ts / media.server.ts pattern), plus the email helper the reminder cron shares
// (src/server/jobs/change-request-reminders.server.ts). README → Change requests, and
// src/features/change-requests/README.md.
//
// The database does the work (role, 2FA, state machine, totals, history, in-app notifications) as the signed-in
// user; these handlers only add the email to the other side, best effort: a failed email is logged and never
// undoes the request or the approval.
import { getRequestUrl } from "@tanstack/react-start/server";
import { logger } from "@/lib/logger";
import { getAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import en from "@/features/comms/i18n/en.json";
import pl from "@/features/comms/i18n/pl.json";
import { homeOf } from "@/features/change-requests/domain/status";
import type { Locale } from "@/i18n/locale";
import type { ProjectRole } from "@/lib/database.types";
import { ServerFnError } from "../errors";
import { sendEmail } from "../email/send-email.server";
import { interpolate } from "../email/html";
import type { AuthContext } from "../middleware/auth";

/** The app's public origin for links in emails: the origin of the (CSRF-checked, same-origin) request. */
export function requestOrigin(): string {
  return getRequestUrl().origin;
}

export type AcceptResult = "ok" | "already_accepted" | "not_open";

type PgError = { code?: string; hint?: string | null; message: string };

/** Turns a Postgres error from one of the change-request RPCs into a ServerFnError with a stable `reason`. */
export function changeRequestRpcError(error: PgError): Error {
  const hint = error.hint ?? undefined;
  if (error.code === "42501") {
    return new ServerFnError("FORBIDDEN", "You can't do this on this project", {
      reason: hint === "mfa_required" ? hint : "decision_forbidden",
    });
  }
  if (error.code === "22023" || error.code === "55000" || error.code === "23514") {
    return new ServerFnError("BAD_REQUEST", error.message, { reason: hint ?? "decision_invalid" });
  }
  return new Error(error.message);
}

const localeOf = (value: unknown): Locale => (value === "en" ? "en" : "pl");

type EmailStrings = (typeof en)["email"];
export type ChangeRequestEmailKind = "changeRequestNew" | "changeRequestAccepted" | "changeRequestReminder";

/** The page a request lives on, opened on that request. */
export function requestLink(siteUrl: string, projectId: string, request: { id: string; cost_delta: number; days_delta: number }): string {
  return `${siteUrl}/projects/${projectId}/${homeOf(request)}?request=${request.id}`;
}

/**
 * Emails every member of `role` on the project (except `exceptUserId`) about one request, each in their own
 * language, with the admin client (emails live in auth.users). A member without an address is skipped; one
 * failed send doesn't stop the others. Resolves to the number of emails sent.
 */
export async function emailProjectMembers(args: {
  admin: AdminSupabase;
  projectId: string;
  role: ProjectRole;
  kind: ChangeRequestEmailKind;
  title: string;
  siteUrl: string;
  linkUrl: string;
  exceptUserId?: string;
}): Promise<number> {
  const { admin } = args;
  const { data: members, error } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", args.projectId)
    .eq("role", args.role);
  if (error) throw error;
  const results = await Promise.allSettled(
    (members ?? [])
      .filter((m) => m.user_id !== args.exceptUserId)
      .map(async (m) => {
        const { data: userData, error: userError } = await admin.auth.admin.getUserById(m.user_id);
        const to = userData?.user?.email;
        if (userError || !to) return false;
        const { data: profile } = await admin.from("profiles").select("locale").eq("id", m.user_id).maybeSingle();
        const locale = localeOf(profile?.locale);
        const s: EmailStrings[ChangeRequestEmailKind] = (locale === "en" ? en : pl).email[args.kind];
        await sendEmail({
          to,
          template: "notification",
          locale,
          params: {
            siteUrl: args.siteUrl,
            title: interpolate(s.title, { title: args.title }),
            body: interpolate(s.body, { title: args.title }),
            linkUrl: args.linkUrl,
            linkLabel: s.cta,
          },
        });
        return true;
      }),
  );
  for (const r of results)
    if (r.status === "rejected") logger.error("change request email failed", { projectId: args.projectId, err: r.reason });
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}

export type CreateChangeRequestInput = {
  projectId: string;
  title: string;
  description: string;
  costDelta: number;
  daysDelta: number;
  stageId: string | null;
};

/** Submits a request as the manager (RPC), then tells the project's clients by email (best effort). */
export async function createChangeRequestHandler(data: CreateChangeRequestInput, context: AuthContext): Promise<{ id: string }> {
  const { data: id, error } = await context.supabase.rpc("create_decision", {
    p_project: data.projectId,
    p_title: data.title,
    p_description: data.description,
    p_cost_delta: data.costDelta,
    p_days_delta: data.daysDelta,
    p_stage: data.stageId ?? undefined,
  });
  if (error) throw changeRequestRpcError(error);

  // The request is saved either way: a failed email must not undo it (the in-app notification is already written).
  try {
    const siteUrl = requestOrigin();
    await emailProjectMembers({
      admin: getAdminSupabase(),
      projectId: data.projectId,
      role: "client",
      kind: "changeRequestNew",
      title: data.title,
      siteUrl,
      linkUrl: requestLink(siteUrl, data.projectId, { id, cost_delta: data.costDelta, days_delta: data.daysDelta }),
    });
  } catch (e) {
    logger.error("change request submitted but the client email failed", { projectId: data.projectId, requestId: id, err: e });
  }
  return { id };
}

/** Approves a request as the client (RPC: row lock, totals, history, in-app notice), then emails the managers. */
export async function acceptChangeRequestHandler(
  data: { projectId: string; requestId: string },
  context: AuthContext,
): Promise<{ result: AcceptResult }> {
  const { data: result, error } = await context.supabase.rpc("accept_decision", { p_decision: data.requestId });
  if (error) throw changeRequestRpcError(error);
  if (result !== "ok") return { result: result as AcceptResult };

  try {
    // Read as the user (RLS): the title and where the request lives, for the email.
    const { data: request } = await context.supabase
      .from("decisions")
      .select("id, title, cost_delta, days_delta")
      .eq("id", data.requestId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (request) {
      const siteUrl = requestOrigin();
      const target = { id: request.id, cost_delta: Number(request.cost_delta), days_delta: request.days_delta };
      await emailProjectMembers({
        admin: getAdminSupabase(),
        projectId: data.projectId,
        role: "manager",
        kind: "changeRequestAccepted",
        title: request.title,
        siteUrl,
        linkUrl: requestLink(siteUrl, data.projectId, target),
      });
    }
  } catch (e) {
    logger.error("change request approved but the manager email failed", { projectId: data.projectId, requestId: data.requestId, err: e });
  }
  return { result: "ok" };
}
