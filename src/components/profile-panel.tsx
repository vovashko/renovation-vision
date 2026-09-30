import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/user-avatar";
import { ManagerBadge } from "@/components/manager/manager-badge";
import { useAuth } from "@/lib/auth";

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

/**
 * Profile side panel opened from the avatar pinned at the bottom of the nav rail (or the phone
 * "More" sheet).
 */
export function ProfilePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(["common"]);
  const { profile, email, signOut } = useAuth();
  const isManager = profile?.account_type === "manager";
  const name = profile?.full_name ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("common:profile.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("common:profile.description")}</SheetDescription>
        </SheetHeader>

        <ProfileIdentity name={name} email={email} isManager={isManager} />

        <Button variant="outline" onClick={signOut} className="mt-auto gap-2">
          <Icon name="logout" size={20} />
          {t("common:profile.signOut")}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
