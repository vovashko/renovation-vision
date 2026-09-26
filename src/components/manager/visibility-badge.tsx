import { Badge } from "@/components/ui/badge";

/**
 * Tells the manager what the client will (not) see. Reuses the status chip's `done` (filled) / `pending`
 * (hollow, dashed) treatment as a visible / hidden metaphor, rather than a bespoke chip style.
 */
export function VisibilityBadge({ visible, hiddenLabel = "Hidden from client" }: { visible: boolean; hiddenLabel?: string }) {
  return visible ? (
    <Badge variant="status-done" size="compact" icon="visibility">
      Client sees this
    </Badge>
  ) : (
    <Badge variant="status-pending" size="compact" icon="visibility_off">
      {hiddenLabel}
    </Badge>
  );
}

export function InternalBadge() {
  return (
    <Badge variant="status-pending" size="compact" icon="lock">
      Internal — never shown to clients
    </Badge>
  );
}
