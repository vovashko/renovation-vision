import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import logo from "@/assets/renovision-logo.svg";
import { Button } from "@/components/ui/button";
import { Card, cardVariants } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const DEMO_HINT = import.meta.env.VITE_DEMO_HINT === "true";

// Fixed seed credentials (see README → Local Supabase), not UI copy: identical in every locale.
const DEMO_ACCOUNTS = {
  managerEmail: "jonas@renovision.demo",
  clientEmail: "sarah@renovision.demo",
  password: "renovision-demo",
};

/** Demo credentials, shown under the form only when VITE_DEMO_HINT=true (hosted demo). */
function DemoHint() {
  const { t } = useTranslation(["auth"]);
  return (
    <Card variant="tinted" className="mt-5 p-4">
      <p className="text-label-sm font-medium text-on-surface-variant uppercase">{t("demoHint.heading")}</p>
      <dl className="mt-2 space-y-1 text-body-sm text-on-surface">
        <div className="flex justify-between gap-3">
          <dt className="text-on-surface-variant">{t("demoHint.manager")}</dt>
          <dd className="tabular-nums">{DEMO_ACCOUNTS.managerEmail}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-on-surface-variant">{t("demoHint.client")}</dt>
          <dd className="tabular-nums">{DEMO_ACCOUNTS.clientEmail}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-on-surface-variant">{t("demoHint.password")}</dt>
          <dd className="tabular-nums">{DEMO_ACCOUNTS.password}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function LoginScreen() {
  const { t } = useTranslation(["auth"]);
  const { signIn, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    if (!email) return toast.error(t("signIn.emailRequired"));
    try {
      await sendMagicLink(email);
      toast.success(t("signIn.magicLinkSent"));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className={cn(cardVariants({ variant: "default" }), "p-6")}>
          <img src={logo} alt={t("signIn.logoAlt")} className="h-9 w-auto" />
          <h1 className="mt-6 text-headline-md text-on-surface">{t("signIn.title")}</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">{t("signIn.subtitle")}</p>
          <FieldGroup className="mt-5">
            <Field>
              <FieldLabel htmlFor="email">{t("signIn.email")}</FieldLabel>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">{t("signIn.password")}</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={busy || !email || !password} size="lg" className="mt-5">
            {busy ? t("signIn.submitting") : t("signIn.submit")}
          </Button>
          <Button type="button" variant="ghost" onClick={magic} className="mt-2 w-full">
            {t("signIn.magicLink")}
          </Button>
        </form>
        {DEMO_HINT && <DemoHint />}
      </div>
    </div>
  );
}
