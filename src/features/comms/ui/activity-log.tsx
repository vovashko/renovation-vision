import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/lib/format";
import type { ActivityEntry } from "@/lib/database.types";

/** The manager-only, internal activity log: a connected timeline of project changes. */
export function ActivityLog({ activity, nameOf }: { activity: ActivityEntry[]; nameOf: (id: string | null) => string }) {
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {activity.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="text-body-md font-medium">{a.summary}</div>
          {Object.keys(a.changes).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(a.changes)
                .slice(0, 4)
                .map(([k, v]) => (
                  <Badge key={k} variant="outline" size="compact">
                    {k.replace(/_/g, " ")}: {String(v.from ?? "—").slice(0, 24)} → {String(v.to ?? "—").slice(0, 24)}
                  </Badge>
                ))}
            </div>
          )}
          <div className="mt-1 text-body-sm text-on-surface-variant">
            {nameOf(a.actor_id)} · {dateTime(a.created_at)}
          </div>
        </li>
      ))}
    </ol>
  );
}
