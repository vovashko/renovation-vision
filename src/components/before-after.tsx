import { useState } from "react";
import { Icon } from "@/components/ui/icon";

export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50);
  // `--pos` carries the slider value; everything else is utilities.
  return (
    <div
      style={{ "--pos": `${pos}%` } as React.CSSProperties}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-container-high select-none has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary"
    >
      <img src={after} alt={`${label}, planned render`} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden [clip-path:inset(0_calc(100%-var(--pos))_0_0)]">
        <img src={before} alt={`${label}, current site photo`} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-(--pos)">
        <div className="h-full w-0.5 -translate-x-1/2 bg-surface" />
        <div className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-on-primary">
          <Icon name="code" size={22} />
        </div>
      </div>
      <span className="absolute top-3 left-3 flex h-6 items-center rounded-sm bg-inverse-surface px-2 text-label-md text-inverse-on-surface">
        Now
      </span>
      <span className="absolute top-3 right-3 flex h-6 items-center rounded-sm bg-primary px-2 text-label-md text-on-primary">Planned</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Compare current and planned ${label}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y opacity-0"
      />
    </div>
  );
}
