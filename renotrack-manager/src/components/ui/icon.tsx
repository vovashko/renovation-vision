import { cn } from "@/lib/utils";

export type IconSize = 16 | 18 | 20 | 22 | 24;

// Literal class strings so Tailwind generates them (no inline styles).
// Weight 300 per the v5 spec; optical size tracks the rendered size.
const sizeClass: Record<IconSize, string> = {
  16: "text-[16px]",
  18: "text-[18px]",
  20: "text-[20px]",
  22: "text-[22px]",
  24: "text-[24px]",
};
const variationClass: Record<IconSize, Record<"on" | "off", string>> = {
  16: {
    off: "[font-variation-settings:'FILL'_0,'wght'_300,'GRAD'_0,'opsz'_16]",
    on: "[font-variation-settings:'FILL'_1,'wght'_300,'GRAD'_0,'opsz'_16]",
  },
  18: {
    off: "[font-variation-settings:'FILL'_0,'wght'_300,'GRAD'_0,'opsz'_18]",
    on: "[font-variation-settings:'FILL'_1,'wght'_300,'GRAD'_0,'opsz'_18]",
  },
  20: {
    off: "[font-variation-settings:'FILL'_0,'wght'_300,'GRAD'_0,'opsz'_20]",
    on: "[font-variation-settings:'FILL'_1,'wght'_300,'GRAD'_0,'opsz'_20]",
  },
  22: {
    off: "[font-variation-settings:'FILL'_0,'wght'_300,'GRAD'_0,'opsz'_22]",
    on: "[font-variation-settings:'FILL'_1,'wght'_300,'GRAD'_0,'opsz'_22]",
  },
  24: {
    off: "[font-variation-settings:'FILL'_0,'wght'_300,'GRAD'_0,'opsz'_24]",
    on: "[font-variation-settings:'FILL'_1,'wght'_300,'GRAD'_0,'opsz'_24]",
  },
};

/** Material Symbols Outlined glyph. Decorative: label the surrounding control instead. */
export function Icon({
  name,
  size = 24,
  fill = false,
  className,
}: {
  name: string;
  size?: IconSize;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("material-symbols-outlined shrink-0", sizeClass[size], variationClass[size][fill ? "on" : "off"], className)}
    >
      {name}
    </span>
  );
}
