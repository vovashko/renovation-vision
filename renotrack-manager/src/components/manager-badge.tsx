import { Icon } from "@/components/ui/icon";

/** Header badge so the portal is never mistaken for the client app. */
export function ManagerBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-background">
      <Icon name="verified_user" size={18} /> Manager
    </span>
  );
}
