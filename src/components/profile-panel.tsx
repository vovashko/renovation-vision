import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import { ManagerBadge } from "@/components/manager/manager-badge";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const personas = ["manager", "client"] as const;

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

        <div className="flex flex-col items-center gap-3 text-center">
          <UserAvatar name={name} src={profile?.avatar_url} className="size-16 text-headline-md" />
          <div>
            <p className="text-title-md text-on-surface">{name}</p>
            {email && <p className="text-body-sm text-on-surface-variant">{email}</p>}
          </div>
          {isManager && <ManagerBadge />}
        </div>

        {isDemo && (
          <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <p className="text-body-sm text-on-surface-variant">Viewing as</p>
            <div role="group" aria-label="Demo persona" className="mt-2 flex rounded-full bg-on-surface/12 p-0.5">
              {personas.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => switchDemoRole(r)}
                  aria-pressed={demoRole === r}
                  className={cn(
                    "h-7.5 flex-1 rounded-full px-3.5 text-[13px] capitalize transition-colors duration-150",
                    demoRole === r ? "bg-surface-container font-medium text-on-surface" : "text-on-surface-variant",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

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
