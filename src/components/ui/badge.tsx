import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// v5 chips: 32px pills (28px `sm` inside cards). Status chips lead with a colored dot;
// attention chips lead with an icon; on tinted panels status chips switch to a white fill.
const badgeVariants = cva(
  "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-label-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        "status-done": "bg-status-done-container text-on-status-done-container",
        "status-progress": "bg-status-progress-container text-on-status-progress-container",
        "status-pending": "bg-status-pending-container text-on-status-pending-container",
        "status-blocked": "bg-status-blocked-container text-on-status-blocked-container",
        attention: "bg-attention-container text-on-attention-container",
        assist:
          "state-layer border border-outline-variant bg-surface-container-lowest text-on-surface",
        live: "border border-outline-variant bg-surface-container-lowest text-on-surface",
        filter:
          "state-layer border border-outline-variant bg-surface-container-lowest text-on-surface",
        "filter-selected": "state-layer bg-primary text-on-primary",
        // shadcn names kept for existing callers
        default: "bg-secondary-container text-on-secondary-container",
        secondary: "bg-secondary-container text-on-secondary-container",
        destructive: "bg-error-container text-on-error-container",
        outline: "border border-outline-variant bg-surface-container-lowest text-on-surface",
      },
      size: {
        default: "",
        sm: "h-7 gap-1.5 px-3 text-label-md",
      },
      /** White fill so status chips stay visible on tinted panels. */
      onPanel: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: ["status-done", "status-progress", "status-pending", "status-blocked"],
        onPanel: true,
        className: "bg-surface-container-lowest",
      },
    ],
    defaultVariants: { variant: "default", size: "default", onPanel: false },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const dotClass: Partial<Record<BadgeVariant, string>> = {
  "status-done": "bg-status-done",
  "status-progress": "bg-status-progress",
  "status-pending": "bg-status-pending",
  "status-blocked": "bg-status-blocked",
  live: "bg-error",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Leading icon; replaces the status dot. Attention chips should pass `euro`/`attach_money` or `schedule`. */
  icon?: string | null;
}

function Badge({ className, variant, size, onPanel, icon, children, ...props }: BadgeProps) {
  const v = variant ?? "default";
  const dot = icon ? undefined : dotClass[v];
  const leadingIcon = icon ?? (v === "filter-selected" ? "check" : undefined);
  return (
    <div className={cn(badgeVariants({ variant, size, onPanel }), className)} {...props}>
      {dot && <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />}
      {leadingIcon && (
        <Icon
          name={leadingIcon}
          size={size === "sm" ? 16 : 18}
          className={v === "attention" ? "text-attention" : undefined}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
