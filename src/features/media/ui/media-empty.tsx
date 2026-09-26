import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/**
 * Empty state for a photo or render slot: a photo grid, filter result, or per-room render section.
 * `compact` is the single-row form used inline (a filtered-out section, a small photo strip).
 */
export function MediaEmpty({
  icon = "photo_camera",
  title,
  text,
  compact = false,
  action,
}: {
  icon?: string;
  title?: string;
  text: string;
  compact?: boolean;
  action?: React.ReactNode;
}) {
  if (compact) {
    return (
      <Empty variant="muted" size="compact">
        <EmptyMedia variant="icon" icon={icon} />
        <EmptyDescription>{text}</EmptyDescription>
      </Empty>
    );
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon={icon} />
        {title && <EmptyTitle>{title}</EmptyTitle>}
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
