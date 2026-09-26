import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// shadcn `empty`, restyled to v5: a dashed hairline box with a round icon tile, a title-md title and a
// body-md description. `muted` sits inside cards and panels (low surface, one step darker tile);
// `compact` is a single row (icon + text) for small slots such as a photo strip.
const emptyVariants = cva("group/empty flex min-w-0 border border-dashed border-outline-variant text-on-surface", {
  variants: {
    variant: {
      default: "rounded-xl bg-surface-container-lowest",
      muted: "rounded-lg bg-surface-container-low",
    },
    size: {
      default: "flex-col items-center justify-center gap-4 p-8 text-center text-balance",
      compact: "flex-row items-center gap-3 rounded-md p-3 text-left",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

function Empty({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>) {
  return (
    <div data-slot="empty" data-variant={variant} data-size={size} className={cn(emptyVariants({ variant, size }), className)} {...props} />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-xs flex-col items-center gap-2 text-center group-data-[size=compact]/empty:max-w-none group-data-[size=compact]/empty:items-start group-data-[size=compact]/empty:gap-0 group-data-[size=compact]/empty:text-left",
        className,
      )}
      {...props}
    />
  );
}

const emptyMediaVariants = cva("flex shrink-0 items-center justify-center", {
  variants: {
    variant: {
      // Children as given (an illustration, an image), or a bare glyph when `icon` is set.
      default: "bg-transparent text-on-surface-variant",
      // 48px round tile holding a 24px Material Symbol. Compact rows drop the tile.
      icon: "mb-1 size-12 rounded-full bg-surface-container-high text-on-surface-variant group-data-[variant=muted]/empty:bg-surface-container-highest group-data-[size=compact]/empty:mb-0 group-data-[size=compact]/empty:size-auto group-data-[size=compact]/empty:bg-transparent",
    },
  },
  defaultVariants: { variant: "default" },
});

type EmptyMediaProps = React.ComponentProps<"div"> &
  VariantProps<typeof emptyMediaVariants> & {
    /** Material Symbols name, e.g. "photo_camera". */
    icon?: string;
  };

function EmptyMedia({ className, variant = "default", icon, children, ...props }: EmptyMediaProps) {
  return (
    <div data-slot="empty-media" data-variant={variant} className={cn(emptyMediaVariants({ variant }), className)} {...props}>
      {icon ? <EmptyGlyph name={icon} /> : children}
    </div>
  );
}

// 24px in the round tile, 20px in a compact row (where the tile collapses to the bare glyph).
function EmptyGlyph({ name }: { name: string }) {
  return <Icon name={name} size={24} className="group-data-[size=compact]/empty:text-[20px]" />;
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="empty-title" className={cn("text-title-md text-on-surface", className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn(
        "text-body-md text-on-surface-variant [&>a]:text-primary [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-on-surface",
        className,
      )}
      {...props}
    />
  );
}

/** Actions under the header (a button or two). */
function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex w-full max-w-xs min-w-0 flex-col items-center gap-3 text-body-md text-balance", className)}
      {...props}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
