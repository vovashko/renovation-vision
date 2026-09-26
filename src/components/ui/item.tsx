import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";

// shadcn `item`, restyled to the v5 list rows. `default` is the Room list row (16px corners, 44px tile,
// label-lg title); `lg` is the Stage list row (card corners, title-md title). Rows that are links or
// buttons (via `asChild`) get the hover surface and a focus outline; plain rows stay static.

/** Vertical list of rows, 8px apart. */
function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="list" data-slot="item-group" className={cn("group/item-group flex flex-col gap-2", className)} {...props} />;
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-slot="item-separator" orientation="horizontal" className={cn("my-0 bg-outline-variant", className)} {...props} />;
}

const itemVariants = cva(
  "group/item flex flex-wrap items-center text-left text-on-surface transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none [a]:cursor-pointer [a]:hover:bg-surface-container-low [button]:cursor-pointer [button]:hover:bg-surface-container-low",
  {
    variants: {
      variant: {
        default: "border border-outline-variant bg-card",
        // No border or fill, for rows inside an already-bordered surface.
        plain: "border border-transparent bg-transparent",
      },
      size: {
        default: "gap-3 rounded-lg py-2 pr-3.5 pl-2",
        lg: "gap-3.5 rounded-xl py-3.5 pr-5 pl-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ItemProps = React.ComponentProps<"div"> & VariantProps<typeof itemVariants> & { asChild?: boolean };

function Item({ className, variant = "default", size = "default", asChild = false, ...props }: ItemProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp data-slot="item" data-variant={variant} data-size={size} className={cn(itemVariants({ variant, size }), className)} {...props} />
  );
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:self-center [&_img]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent text-on-surface-variant",
        // 44px tile with a 22px Material Symbol (room icon, stage number).
        icon: "size-11 rounded-md text-label-lg",
        image: "size-11 overflow-hidden rounded-md [&_img]:size-full [&_img]:object-cover",
      },
      // Tile fill for `icon`. Status tones follow the chip colours; pending is hollow.
      tone: {
        neutral: "",
        done: "",
        progress: "",
        pending: "",
        blocked: "",
      },
    },
    compoundVariants: [
      { variant: "icon", tone: "neutral", className: "bg-surface-container-high text-on-surface" },
      { variant: "icon", tone: "done", className: "bg-status-done-container text-on-status-done-container" },
      { variant: "icon", tone: "progress", className: "bg-status-progress-container text-on-status-progress-container" },
      {
        variant: "icon",
        tone: "pending",
        className: "border border-dashed border-outline bg-status-pending-container text-on-status-pending-container",
      },
      { variant: "icon", tone: "blocked", className: "bg-status-blocked-container text-on-status-blocked-container" },
    ],
    defaultVariants: { variant: "default", tone: "neutral" },
  },
);

type ItemMediaProps = React.ComponentProps<"div"> &
  VariantProps<typeof itemMediaVariants> & {
    /** Material Symbols name, e.g. "countertops". Rendered at 22px in an `icon` tile, 20px otherwise. */
    icon?: string;
  };

function ItemMedia({ className, variant = "default", tone = "neutral", icon, children, ...props }: ItemMediaProps) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, tone: variant === "icon" ? tone : undefined }), className)}
      {...props}
    >
      {icon ? <Icon name={icon} size={variant === "icon" ? 22 : 20} /> : children}
    </div>
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex min-w-0 flex-1 flex-col [&+[data-slot=item-content]]:flex-none", className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "flex w-fit min-w-0 items-center gap-2 text-label-lg text-on-surface group-data-[size=lg]/item:text-title-md",
        className,
      )}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "line-clamp-2 text-body-sm text-on-surface-variant [&>a]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      {...props}
    />
  );
}

/** Trailing slot: a chevron, a percentage, a menu button. */
function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-actions" className={cn("flex items-center gap-2 text-on-surface-variant", className)} {...props} />;
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-header" className={cn("flex basis-full items-center justify-between gap-2", className)} {...props} />;
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-footer" className={cn("flex basis-full items-center justify-between gap-2", className)} {...props} />;
}

export { Item, ItemMedia, ItemContent, ItemActions, ItemGroup, ItemSeparator, ItemTitle, ItemDescription, ItemHeader, ItemFooter };
