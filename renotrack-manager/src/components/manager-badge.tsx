import { ShieldCheck } from "lucide-react";

/** Header badge so the portal is never mistaken for the client app. */
export function ManagerBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-background">
      <ShieldCheck className="h-3.5 w-3.5" /> Manager
    </span>
  );
}
