import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  // Radio-group keyboard pattern: one tab stop, arrow keys move the selection.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    const btn = e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`);
    btn?.focus();
    btn?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-2 md:mx-0 md:flex-wrap md:px-0"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            data-value={o.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              badgeVariants({ variant: active ? "filter-selected" : "filter" }),
              // 32px chip, but keep a 44px tap target via an invisible hit-area extension.
              "relative shrink-0 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
            )}
          >
            {active && <Icon name="check" size={18} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
