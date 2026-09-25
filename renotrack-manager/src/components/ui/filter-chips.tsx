import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** Single-select filter chips. Selected: primary with a check; others: white assist chips. */
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
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1.5 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              // 32px chip; the ::after extends the tap target to 44px without making the chip taller.
              "state-layer relative inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-label-lg after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active ? "bg-primary pl-2.5 text-on-primary" : "border border-outline-variant bg-surface-container-lowest text-on-surface",
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
