import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-sheet";
import { PageHeader } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RenoTrack Manager" },
      { name: "description", content: "Your name, photo, email and password." },
    ],
  }),
  component: SettingsPage,
});

function splitName(full: string) {
  const [first = "", ...rest] = full.trim().split(/\s+/);
  return { first, last: rest.join(" ") };
}

function SettingsPage() {
  const { profile, email, isDemo, saveProfile, changeEmail, changePassword, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // undefined = keep the current photo, null = remove it, File = replace it
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const n = splitName(profile?.full_name ?? "");
    setFirst(n.first);
    setLast(n.last);
    setMail(email ?? "");
  }, [profile?.full_name, email]);

  const currentPhoto = photo === undefined ? profile?.avatar_url : photo === null ? null : preview;
  const emailChanged = mail.trim() !== (email ?? "") && mail.trim() !== "";
  const passwordError =
    password && password.length < 8 ? "Use at least 8 characters." : password && confirm && password !== confirm ? "The passwords don't match." : "";
  const canSave = !!first.trim() && !passwordError && (!password || password === confirm) && !saving;

  const pickPhoto = (f: File | undefined) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const done: string[] = [];
    try {
      await saveProfile({ firstName: first, lastName: last, photo });
      done.push("Profile saved");
      if (emailChanged) {
        await changeEmail(mail.trim());
        done.push("check your inbox to confirm the new email");
      }
      if (password) {
        await changePassword(password);
        done.push("password changed");
        setPassword("");
        setConfirm("");
      }
      setPhoto(undefined);
      toast.success(done.join(", ").replace(/^./, (c) => c.toUpperCase()));
    } catch (err) {
      toast.error(done.length ? `${done.join(", ")}. But: ${(err as Error).message}` : (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title="Settings" description="Your profile and sign-in details." />
      <form onSubmit={submit} className="mt-6 max-w-2xl space-y-6">
        <Card className="space-y-6 p-5 md:p-6">
          <section aria-labelledby="profile-heading" className="space-y-4">
            <h2 id="profile-heading" className="text-title-md">Profile</h2>
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar name={`${first} ${last}`} src={currentPhoto} className="size-18 text-title-lg" />
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Icon name="add_a_photo" size={20} />
                  {currentPhoto ? "Change photo" : "Upload photo"}
                </Button>
                {currentPhoto && (
                  <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="st-first" label="First name">
                <Input id="st-first" required autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />
              </Field>
              <Field id="st-last" label="Surname">
                <Input id="st-last" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
              </Field>
            </div>
          </section>

          <section aria-labelledby="email-heading" className="space-y-4 border-t border-outline-variant pt-6">
            <h2 id="email-heading" className="text-title-md">Email</h2>
            <Field
              id="st-email"
              label="Email address"
              hint={isDemo ? "The demo can't change sign-in details." : emailChanged ? "We'll send a link to confirm the new address." : undefined}
            >
              <Input id="st-email" type="email" autoComplete="email" value={mail} onChange={(e) => setMail(e.target.value)} disabled={isDemo} />
            </Field>
          </section>

          <section aria-labelledby="password-heading" className="space-y-4 border-t border-outline-variant pt-6">
            <h2 id="password-heading" className="text-title-md">Password</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="st-password" label="New password" hint={isDemo ? "The demo can't change sign-in details." : "Leave blank to keep your current password."}>
                <Input id="st-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isDemo} />
              </Field>
              <Field id="st-confirm" label="Confirm new password">
                <Input id="st-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={isDemo || !password} />
              </Field>
            </div>
            {passwordError && (
              <p role="alert" className="text-body-sm text-error">
                {passwordError}
              </p>
            )}
          </section>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {!isDemo && (
            <Button type="button" variant="ghost" onClick={signOut}>
              <Icon name="logout" size={20} />
              Sign out
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
