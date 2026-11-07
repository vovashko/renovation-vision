import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Note } from "@/components/ui/note";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import {
  changeEmailSchema,
  emailChangeErrorKey,
  emailChangeLanding,
  withoutLandingParams,
  type EmailChangeErrorKey,
  type EmailChangeLanding,
} from "../domain/email";
import { useAccountEmail, useRequestEmailChange } from "../hooks/use-email-change";

/** What a confirmation link reported when it landed here; read once, then dropped from the URL. */
function useEmailChangeLanding(): EmailChangeLanding {
  const [landing, setLanding] = useState<EmailChangeLanding>(null);
  useEffect(() => {
    const found = emailChangeLanding(window.location.href);
    if (!found) return;
    setLanding(found);
    window.history.replaceState(window.history.state, "", withoutLandingParams(window.location.href));
  }, []);
  return landing;
}

function CurrentEmail({ email }: { email: string }) {
  const { t } = useTranslation(["settings"]);
  return (
    <Item variant="plain" data-testid="current-email">
      <ItemMedia variant="icon" icon="mail" />
      <ItemContent>
        <ItemTitle className="truncate">{email}</ItemTitle>
        <ItemDescription>{t("email.current")}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

/** A change is waiting for both confirmation links. */
function PendingChangeNote({ current, next, partial }: { current: string; next: string; partial: boolean }) {
  const { t } = useTranslation(["settings"]);
  return <Note tone="success">{partial ? t("email.partial", { email: next }) : t("email.pending", { current, next })}</Note>;
}

function EmailChangeForm({ current, onSent }: { current: string; onSent: (email: string) => void }) {
  const { t } = useTranslation(["settings", "auth", "common"]);
  const form = useZodForm(changeEmailSchema(current), { email: "" });
  const request = useRequestEmailChange();
  const [error, setError] = useState<EmailChangeErrorKey | null>(null);

  const submit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await request.mutateAsync(email);
      form.reset();
      onSent(email);
    } catch (err) {
      setError(emailChangeErrorKey(err));
    }
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormField control={form.control} name="email" label={t("email.new")}>
        {(field) => <Input type="email" autoComplete="email" inputMode="email" {...field} />}
      </FormField>
      {error && <Note tone="error">{t(error)}</Note>}
      <Button type="submit" className="self-start" disabled={request.isPending}>
        {request.isPending ? t("email.submitting") : t("email.submit")}
      </Button>
    </form>
  );
}

/**
 * Settings → Security: change the login email with Supabase's secure email change. Both the current and the new
 * address get a confirmation link; the email changes (and T35's trigger moves the client contact along) once both
 * are opened.
 */
export function ChangeEmailCard({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "auth", "common"]);
  const account = useAccountEmail();
  const landing = useEmailChangeLanding();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const current = account.data?.email ?? null;
  const pending = account.data?.newEmail ?? sentTo;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("email.title")}</CardTitle>
        <CardDescription>{t("email.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {account.isPending ? (
          <Note>{t("common:state.loading")}</Note>
        ) : !current ? (
          <Note tone="error">{t("auth:errors.generic")}</Note>
        ) : (
          <>
            <CurrentEmail email={current} />
            {landing === "failed" && <Note tone="error">{t("auth:errors.linkExpired")}</Note>}
            {pending && pending !== current && <PendingChangeNote current={current} next={pending} partial={landing === "partial"} />}
            <EmailChangeForm current={current} onSent={setSentTo} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
