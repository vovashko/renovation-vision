import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import { ManagerBadge } from "@/components/manager/manager-badge";
import { useAuth } from "@/lib/auth";
import type { DemoRole } from "@/lib/demo-api";
import { cn } from "@/lib/utils";

const personas: DemoRole[] = ["manager", "client"];

/** Name, photo, email and the manager badge, centered at the top of the panel. */
function ProfileIdentity({ name, email, isManager }: { name: string; email: string | null; isManager: boolean }) {
  const { profile } = useAuth();
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <UserAvatar name={name} src={profile?.avatar_url} className="size-16 text-headline-md" />
      <div>
        <p className="text-title-md text-on-surface">{name}</p>
        {email && <p className="text-body-sm text-on-surface-variant">{email}</p>}
      </div>
      {isManager && <ManagerBadge />}
    </div>
  );
}

/** Segmented control (spec "Inputs"): switches which demo persona is signed in. */
function DemoPersonaSwitch({ value, onChange }: { value: DemoRole; onChange: (role: DemoRole) => void }) {
  return (
    <Card variant="tinted" className="p-4">
      <p className="text-body-sm text-on-surface-variant">Viewing as</p>
      <div role="group" aria-label="Demo persona" className="mt-2 flex rounded-full bg-on-surface/12 p-0.5">
        {personas.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            aria-pressed={value === r}
            className={cn(
              "h-7.5 flex-1 rounded-full px-3.5 text-[13px] capitalize transition-colors duration-150",
              value === r ? "bg-surface-container font-medium text-on-surface" : "text-on-surface-variant",
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </Card>
  );
}

/**
 * Profile side panel opened from the avatar pinned at the bottom of the nav rail (or the phone
 * "More" sheet). Demo mode swaps in the persona switch instead of real account actions; a real
 * session keeps the sign-out button.
 */
export function ProfilePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { profile, email, isDemo, demoRole, switchDemoRole, signOut } = useAuth();
  const isManager = profile?.account_type === "manager";
  const name = profile?.full_name ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
          <SheetDescription className="sr-only">Your account details{isDemo ? " and demo persona" : ""}.</SheetDescription>
        </SheetHeader>

        <ProfileIdentity name={name} email={email} isManager={isManager} />

        {isDemo && <DemoPersonaSwitch value={demoRole} onChange={switchDemoRole} />}

        {!isDemo && (
          <Button variant="outline" onClick={signOut} className="mt-auto gap-2">
            <Icon name="logout" size={20} />
            Sign out
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
