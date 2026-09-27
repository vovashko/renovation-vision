import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const { t } = useTranslation(["media"]);
  const [pos, setPos] = useState(50);
  // `--pos` carries the slider value; everything else is utilities.
  return (
    <div
      style={{ "--pos": `${pos}%` } as React.CSSProperties}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-container-high select-none has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary"
    >
      <img src={after} alt={t("beforeAfter.afterAlt", { label })} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden [clip-path:inset(0_calc(100%-var(--pos))_0_0)]">
        <img src={before} alt={t("beforeAfter.beforeAlt", { label })} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-(--pos)">
        <div className="h-full w-0.5 -translate-x-1/2 bg-surface" />
        <div className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-on-primary">
          <Icon name="code" size={22} />
        </div>
      </div>
      <Badge icon={null} size="compact" variant="scrim" className="absolute top-3 left-3">
        {t("beforeAfter.now")}
      </Badge>
      <Badge icon={null} size="compact" variant="filter-selected" className="absolute top-3 right-3">
        {t("beforeAfter.planned")}
      </Badge>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={t("beforeAfter.compareAria", { label })}
        className="absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y opacity-0"
      />
    </div>
  );
}
