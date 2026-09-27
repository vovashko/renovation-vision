/**
 * Centered date caption between two days of messages ("Today", "Yesterday", "Mon, Apr 20").
 * A one-off caption with no border, tile or interaction — not worth a `ui/` primitive of its own.
 */
export function DaySeparator({ label }: { label: string }) {
  return <div className="my-3 text-center text-label-md text-on-surface-variant">{label}</div>;
}
