import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// M3 chips: 32px tall, 8px corners. A leading icon switches to pl-2.
const badgeVariants = cva(
  "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-sm px-4 text-label-lg has-[>.material-symbols-outlined:first-child]:pl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        assist: "state-layer border border-outline-variant text-on-surface",
        filter: "state-layer border border-outline-variant text-on-surface-variant",
        "filter-selected": "state-layer bg-secondary-container text-on-secondary-container",
        "status-done": "bg-status-done-container text-on-status-done-container",
        "status-progress": "bg-status-progress-container text-on-status-progress-container",
        "status-pending": "bg-status-pending-container text-on-status-pending-container",
        "status-blocked": "bg-status-blocked-container text-on-status-blocked-container",
        // shadcn names kept for existing callers
        default: "bg-secondary-container text-on-secondary-container",
        secondary: "bg-secondary-container text-on-secondary-container",
        destructive: "bg-error-container text-on-error-container",
        outline: "border border-outline-variant text-on-surface",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Leading icon each chip variant shows unless `icon` overrides it (`null` hides it). */
const defaultIcon: Partial<Record<BadgeVariant, string>> = {
  "filter-selected": "check",
  "status-done": "check_circle",
  "status-progress": "construction",
  "status-pending": "schedule",
  "status-blocked": "block",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  icon?: string | null;
}

function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  const iconName = icon === null ? undefined : (icon ?? defaultIcon[variant ?? "default"]);
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {iconName && <Icon name={iconName} size={18} />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
