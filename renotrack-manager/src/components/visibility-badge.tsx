import { Eye, EyeOff, Lock } from "lucide-react";

/** Tells the manager what the client will (not) see. */
export function VisibilityBadge({ visible, hiddenLabel = "Hidden from client" }: { visible: boolean; hiddenLabel?: string }) {
  return visible ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
      <Eye className="h-3.5 w-3.5" /> Client sees this
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <EyeOff className="h-3.5 w-3.5" /> {hiddenLabel}
    </span>
  );
}

export function InternalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <Lock className="h-3.5 w-3.5" /> Internal — never shown to clients
    </span>
  );
}
