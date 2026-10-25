import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthCard, AuthCardFooter, AuthCardHeader, AuthScreen } from "@/components/ui/auth-screen";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Note } from "@/components/ui/note";
import { LOCALES, useLocale, useSetLocale } from "@/i18n";
import type { Locale } from "@/i18n/locale";
import { useSessionRefresh } from "@/lib/auth";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { authErrorCode, authErrorKey } from "@/features/auth/domain/auth-errors";
import { NewPasswordFields } from "@/features/auth/ui/new-password-fields";
import type { InviteLookup } from "@/server/functions/invites";
import { acceptInviteSchema, type AcceptInviteValues } from "../domain/invites";
import { useAcceptInvite, useInviteLookup, useSessionEmail, type AcceptOutcome } from "../hooks/invites";
import { usePeopleErrorText } from "../hooks/errors";

type PendingInvite = Extract<InviteLookup, { status: "pending" }>;
type DeadEnd = Exclude<AcceptOutcome["status"], "accepted"> | Exclude<InviteLookup["status"], "pending">;

const statusKey = (status: DeadEnd) => (status === "needs_sign_in" ? "needsSignIn" : status);

/** Expired, used, withdrawn or broken link: say which, and offer to sign in where that helps. */
function InviteDeadEnd({ status, acceptHref }: { status: DeadEnd; acceptHref: string }) {
  const { t } = useTranslation(["people"]);
  const signIn = status === "used" || status === "needs_sign_in";
  return (
    <>
      <Note tone="error">{t(`invite.accept.status.${statusKey(status)}`)}</Note>
      {signIn && (
        <Button asChild size="lg">
          <Link to="/login" search={status === "needs_sign_in" ? { redirect: acceptHref } : {}}>
            {t("invite.accept.signIn")}
          </Link>
        </Button>
      )}
    </>
  );
}

/** The failed step, translated: gotrue's error code, or the invite RPC/server function's reason. */
function useAcceptErrorText(): (error: unknown) => string {
  const { t } = useTranslation(["auth"]);
  const peopleText = usePeopleErrorText();
  return (error) => (authErrorCode(error) ? t(authErrorKey(error)) : peopleText(error instanceof Error ? error : new Error()));
}

function InviteAcceptForm({
  invite,
  tokenHash,
  signedIn,
  onDeadEnd,
}: {
  invite: PendingInvite;
  tokenHash: string;
  signedIn: boolean;
  onDeadEnd: (status: DeadEnd) => void;
}) {
  const { t } = useTranslation(["people", "common"]);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const refresh = useSessionRefresh();
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const errorText = useAcceptErrorText();
  const form = useZodForm(acceptInviteSchema(!signedIn), {
    fullName: "",
    locale,
    privacy: false as unknown as true,
    password: "",
    confirm: "",
  });

  const submit = form.handleSubmit(async (values: AcceptInviteValues) => {
    const outcome = await accept.submit({
      tokenHash,
      signedIn,
      fullName: values.fullName,
      locale: values.locale,
      password: values.password,
    });
    if (!outcome) return;
    if (outcome.status !== "accepted") return onDeadEnd(outcome.status);
    // Fresh router context first, so the guards see the new account (a manager may be sent to set up 2FA).
    await refresh();
    if (outcome.projectId) await navigate({ to: "/projects/$projectId", params: { projectId: outcome.projectId }, replace: true });
    else await navigate({ to: "/", replace: true });
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup>
        <FormField control={form.control} name="fullName" label={t("invite.accept.fullName")}>
          {(field) => <Input autoComplete="name" {...field} />}
        </FormField>
        <FormField control={form.control} name="locale" label={t("invite.accept.language")}>
          {(field) => (
            <NativeSelect
              {...field}
              onChange={(e) => {
                field.onChange(e);
                void setLocale(e.target.value as Locale);
              }}
            >
              {LOCALES.map((l) => (
                <NativeSelectOption key={l} value={l} lang={l}>
                  {t(`common:language.${l}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </FieldGroup>
      {signedIn ? (
        <Note>{t("invite.accept.signedInAs", { email: invite.email })}</Note>
      ) : (
        <NewPasswordFields control={form.control as never} />
      )}
      <FormField control={form.control} name="privacy" orientation="horizontal" label={t("invite.accept.privacy")}>
        {({ value, onChange, ...field }) => (
          <Checkbox {...field} value="accepted" checked={value === true} onCheckedChange={(v) => onChange(v === true)} />
        )}
      </FormField>
      {accept.error != null && <Note tone="error">{errorText(accept.error)}</Note>}
      <Button type="submit" size="lg" disabled={accept.pending}>
        {accept.pending ? t("invite.accept.submitting") : t("invite.accept.submit")}
      </Button>
    </form>
  );
}

/** /accept-invite: check the link, then name, password, language and privacy consent; land on the project. */
export function InviteAcceptScreen({ tokenHash }: { tokenHash: string | null }) {
  const { t } = useTranslation(["people", "auth"]);
  const lookup = useInviteLookup(tokenHash);
  const session = useSessionEmail();
  // Kept once seen, with whether this browser was already signed in as the invitee: signing in through the link
  // clears and refetches every query (AuthSync), and accepting turns the lookup into "used".
  const [ready, setReady] = useState<{ invite: PendingInvite; signedIn: boolean } | null>(null);
  const [deadEnd, setDeadEnd] = useState<DeadEnd | null>(null);
  const data = lookup.data;
  const sessionEmail = session.isLoading ? undefined : (session.data ?? null);
  useEffect(() => {
    if (!ready && data?.status === "pending" && sessionEmail !== undefined) {
      setReady({ invite: data, signedIn: sessionEmail === data.email });
    }
  }, [ready, data, sessionEmail]);
  const invite = ready?.invite ?? null;

  const lookupDeadEnd: DeadEnd | null = lookup.isError ? "invalid" : data && data.status !== "pending" && !invite ? data.status : null;
  const shown = deadEnd ?? lookupDeadEnd;
  const acceptHref = `/accept-invite?token_hash=${encodeURIComponent(tokenHash ?? "")}&type=invite`;
  const inviter = invite?.inviterName || t("invite.accept.someone");
  const description =
    invite && !shown
      ? t(invite.role === "manager" ? "invite.accept.descriptionManager" : "invite.accept.descriptionClient", {
          inviter,
          project: invite.projectName,
        })
      : undefined;

  return (
    <AuthScreen>
      <AuthCard>
        <AuthCardHeader title={t("invite.accept.title")} description={description} />
        {shown ? (
          <InviteDeadEnd status={shown} acceptHref={acceptHref} />
        ) : ready && tokenHash ? (
          <InviteAcceptForm invite={ready.invite} tokenHash={tokenHash} signedIn={ready.signedIn} onDeadEnd={setDeadEnd} />
        ) : (
          <Note tone="success">{t("invite.accept.checking")}</Note>
        )}
        <AuthCardFooter>
          <Button asChild variant="link">
            <Link to="/login">{t("auth:backToSignIn")}</Link>
          </Button>
        </AuthCardFooter>
      </AuthCard>
    </AuthScreen>
  );
}
