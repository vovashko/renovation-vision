import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// v5 chips: 32px pills (28px `compact` inside cards) with a leading 8px dot or 18px icon.
const badgeVariants = cva("inline-flex items-center gap-2 whitespace-nowrap rounded-full text-label-lg", {
  variants: {
    variant: {
      "status-done": "bg-status-done-container text-on-status-done-container",
      "status-progress": "bg-status-progress-container text-on-status-progress-container",
      // Not started: never filled. White with a dashed outline and a hollow dot.
      "status-pending": "border border-dashed border-outline bg-status-pending-container text-on-status-pending-container",
      "status-blocked": "bg-status-blocked-container text-on-status-blocked-container",
      // Over budget / late only. Pass icon="euro" (or the currency) or icon="schedule".
      attention: "bg-attention-container text-on-attention-container",
      assist: "border border-outline-variant bg-surface-container-lowest text-on-surface",
      live: "border border-outline-variant bg-surface-container-lowest text-on-surface",
      "filter-selected": "bg-primary text-on-primary",
      // shadcn names kept for existing callers
      default: "bg-secondary-container text-on-secondary-container",
      secondary: "bg-secondary-container text-on-secondary-container",
      destructive: "bg-error-container text-on-error-container",
      outline: "border border-outline-variant text-on-surface",
    },
    size: {
      default: "h-8 px-3.5",
      compact: "h-7 px-3 text-label-md",
    },
    // On tinted panels (surface-container-high or darker) chips switch to a white fill.
    onPanel: { true: "", false: "" },
  },
  compoundVariants: [
    {
      onPanel: true,
      variant: ["status-done", "status-progress", "status-blocked", "default", "secondary"],
      class: "bg-surface-container-lowest",
    },
  ],
  defaultVariants: { variant: "default", size: "default", onPanel: false },
});

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const dotClass: Partial<Record<BadgeVariant, string>> = {
  "status-done": "bg-status-done",
  "status-progress": "bg-status-progress",
  "status-pending": "border-2 border-status-pending bg-transparent",
  "status-blocked": "bg-status-blocked",
  live: "bg-error",
};

const defaultIcon: Partial<Record<BadgeVariant, string>> = {
  "filter-selected": "check",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Leading 18px icon; replaces the dot. `null` hides the default icon. */
  icon?: string | null;
}

function Badge({ className, variant, size, onPanel, icon, children, ...props }: BadgeProps) {
  const v = variant ?? "default";
  const iconName = icon === null ? undefined : (icon ?? defaultIcon[v]);
  const dot = !iconName && dotClass[v];
  return (
    <span className={cn(badgeVariants({ variant, size, onPanel }), className)} {...props}>
      {dot && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />}
      {iconName && <Icon name={iconName} size={18} className={v === "attention" ? "text-attention" : undefined} />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
