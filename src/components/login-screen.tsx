import { useState } from "react";
import logo from "@/assets/renovision-logo.svg";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

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
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-surface)] px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-[var(--shadow-elegant)]">
        <img src={logo} alt="RenoVision" className="h-10 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Clients and site managers sign in here.</p>
        <div className="mt-5 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </div>
        </div>
        <Button type="submit" disabled={busy || !email || !password} className="mt-5 min-h-11 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Button type="button" variant="ghost" onClick={magic} className="mt-2 min-h-11 w-full">
          Email me a sign-in link
        </Button>
      </form>
    </div>
  );
}
