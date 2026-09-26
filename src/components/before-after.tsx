import { useState } from "react";

export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted shadow-[var(--shadow-soft)] select-none">
      <img src={after} alt={`${label} — planned render`} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={`${label} — current site photo`} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="h-full w-0.5 -translate-x-1/2 bg-background shadow" />
        <div className="absolute top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-lg" />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium text-background">Now</span>
      <span className="absolute top-3 right-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
        Planned
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Compare current and planned ${label}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
