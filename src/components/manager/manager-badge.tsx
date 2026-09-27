import { Badge } from "@/components/ui/badge";

/** Chip that marks a manager's account in the profile panel, so it's never mistaken for a client's. */
export function ManagerBadge({ onPanel = false, className }: { onPanel?: boolean; className?: string } = {}) {
  return (
    <Badge variant="default" size="compact" icon="verified_user" onPanel={onPanel} className={className}>
      Manager
    </Badge>
  );
}
