import { BeforeAfter } from "@/components/before-after";

/** The "now vs. planned" before/after slider for a room's headline render, with the manager's visibility note. */
export function RenderCompare({
  roomName,
  title,
  before,
  after,
  note,
}: {
  roomName: string;
  title: string;
  before: string;
  after: string;
  note?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-title-lg">{roomName}: now vs. planned</h2>
        {note && <p className="text-body-md text-on-surface-variant">{note}</p>}
      </div>
      <div className="max-w-3xl">
        <BeforeAfter before={before} after={after} label={title} />
      </div>
    </section>
  );
}
