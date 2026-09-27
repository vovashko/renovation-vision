import { useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/renovision-logo.svg";
import { Button } from "@/components/ui/button";
import { Card, cardVariants } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const DEMO_HINT = import.meta.env.VITE_DEMO_HINT === "true";

/** Demo credentials, shown under the form only when VITE_DEMO_HINT=true (hosted demo). */
function DemoHint() {
  return (
    <Card variant="tinted" className="mt-5 p-4">
      <p className="text-label-sm font-medium text-on-surface-variant uppercase">Demo accounts</p>
      <dl className="mt-2 space-y-1 text-body-sm text-on-surface">
        <div className="flex justify-between gap-3">
          <dt className="text-on-surface-variant">Manager</dt>
          <dd className="tabular-nums">jonas@renovision.demo</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-on-surface-variant">Client</dt>
          <dd className="tabular-nums">sarah@renovision.demo</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-on-surface-variant">Password</dt>
          <dd className="tabular-nums">renovision-demo</dd>
        </div>
      </dl>
    </Card>
  );
}

export function LoginScreen() {
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
    if (!email) return toast.error("Enter your email first");
    try {
      await sendMagicLink(email);
      toast.success("Check your inbox for a sign-in link");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className={cn(cardVariants({ variant: "default" }), "p-6")}>
          <img src={logo} alt="RenoVision" className="h-9 w-auto" />
          <h1 className="mt-6 text-headline-md text-on-surface">Sign in</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Clients and site managers sign in here.</p>
          <FieldGroup className="mt-5">
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
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
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <Button type="button" variant="ghost" onClick={magic} className="mt-2 w-full">
            Email me a sign-in link
          </Button>
        </form>
        {DEMO_HINT && <DemoHint />}
      </div>
    </div>
  );
}
