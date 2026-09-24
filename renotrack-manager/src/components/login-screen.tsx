import { useState } from "react";
import { Hammer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManagerBadge } from "@/components/manager-badge";
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
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-soft)]">
            <Hammer className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">RenoTrack</span>
            <span className="text-xs text-muted-foreground">Site admin portal</span>
          </div>
          <div className="ml-auto"><ManagerBadge /></div>
        </div>
        <h1 className="mt-6 text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">For site managers. Clients use the RenoTrack app.</p>
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

export function NotAManagerScreen() {
  const { signOut, email } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-surface)] px-4">
      <div className="max-w-sm rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-elegant)]">
        <h1 className="text-xl font-semibold">This portal is for site managers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {email} is a client account. Open the RenoTrack app to follow your renovation.
        </p>
        <Button onClick={signOut} variant="outline" className="mt-5 min-h-11">Sign out</Button>
      </div>
    </div>
  );
}
