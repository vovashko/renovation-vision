import { Badge } from "@/components/ui/badge";

/** Chip that marks the manager portal so it is never mistaken for the client app. */
export function ManagerBadge({ onPanel = false, className }: { onPanel?: boolean; className?: string }) {
  return (
    <Badge variant="default" size="compact" icon="verified_user" onPanel={onPanel} className={className}>
      Manager
    </Badge>
  );
}
