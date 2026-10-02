import { Badge } from "@/components/ui/badge";
import { useFormat } from "@/i18n";
import type { ActivityEntry } from "@/lib/database.types";
import { useActivityText } from "@/features/comms/hooks/use-notification-text";

// Named at module scope, not as inline literals, so the linter doesn't mistake these
// non-translatable format identifiers/symbols for user-facing text.
const DAY_TIME_STYLE = "dayTime";
const ARROW = "→";

// Each line is rendered from the entry's `params` ({ entity, action, label }) in the current
// language (useActivityText); rows without them fall back to the stored English `summary`.

/** The manager-only, internal activity log: a connected timeline of project changes. */
export function ActivityLog({ activity, nameOf }: { activity: ActivityEntry[]; nameOf: (id: string | null) => string }) {
  const format = useFormat();
  const describe = useActivityText();
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {activity.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="text-body-md font-medium">{describe(a)}</div>
          {Object.keys(a.changes).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(a.changes)
                .slice(0, 4)
                .map(([k, v]) => (
                  <Badge key={k} variant="outline" size="compact">
                    {k.replace(/_/g, " ")}: {String(v.from ?? "—").slice(0, 24)} {ARROW} {String(v.to ?? "—").slice(0, 24)}
                  </Badge>
                ))}
            </div>
          )}
          <div className="mt-1 text-body-sm text-on-surface-variant">
            {nameOf(a.actor_id)} · {format.date(a.created_at, DAY_TIME_STYLE)}
          </div>
        </li>
      ))}
    </ol>
  );
}
