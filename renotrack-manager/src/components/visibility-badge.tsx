import { Icon } from "@/components/ui/icon";

/** Tells the manager what the client will (not) see. */
export function VisibilityBadge({ visible, hiddenLabel = "Hidden from client" }: { visible: boolean; hiddenLabel?: string }) {
  return visible ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
      <Icon name="visibility" size={18} /> Client sees this
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <Icon name="visibility_off" size={18} /> {hiddenLabel}
    </span>
  );
}

export function InternalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <Icon name="lock" size={18} /> Internal — never shown to clients
    </span>
  );
}
