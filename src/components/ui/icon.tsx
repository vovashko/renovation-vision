import { cn } from "@/lib/utils";

export type IconSize = 18 | 20 | 24;

// Literal class strings so Tailwind generates them. Optical size tracks the rendered size.
const sizeClass: Record<IconSize, string> = {
  18: "text-[18px]",
  20: "text-[20px]",
  24: "text-[24px]",
};
const variationClass: Record<IconSize, Record<"on" | "off", string>> = {
  18: {
    off: "[font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_18]",
    on: "[font-variation-settings:'FILL'_1,'wght'_400,'GRAD'_0,'opsz'_18]",
  },
  20: {
    off: "[font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_20]",
    on: "[font-variation-settings:'FILL'_1,'wght'_400,'GRAD'_0,'opsz'_20]",
  },
  24: {
    off: "[font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24]",
    on: "[font-variation-settings:'FILL'_1,'wght'_400,'GRAD'_0,'opsz'_24]",
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
      className={cn(
        "material-symbols-outlined shrink-0",
        sizeClass[size],
        variationClass[size][fill ? "on" : "off"],
        className,
      )}
    >
      {name}
    </span>
  );
}
