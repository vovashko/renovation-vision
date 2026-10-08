import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// v5 banner: page-wide message at the top of a page, 16px corners, one optional action on the right.
// Over budget / late use `attention`, never `error`; `error` is for system problems (offline, sync failed).
const bannerVariants = cva("flex flex-wrap items-center gap-3 rounded-lg py-3 pr-3 pl-4 text-body-md", {
  variants: {
    variant: {
      attention: "border border-attention-outline bg-attention-container text-on-attention-container [&_[data-slot=banner-icon]]:text-attention",
      info: "bg-secondary-container text-on-secondary-container",
      error: "bg-error-container text-on-error-container [&_[data-slot=banner-icon]]:text-error",
    },
  },
  defaultVariants: { variant: "info" },
});

const defaultIcon = { attention: "warning", info: "info", error: "error" } as const;

type BannerProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof bannerVariants> & {
    /** Material Symbols name; defaults per variant. */
    icon?: string;
    /** Bold lead-in, e.g. "Kitchen is 4% over budget." */
    title?: React.ReactNode;
    /** A single text button, e.g. <Button variant="ghost" size="sm">Review</Button>. */
    action?: React.ReactNode;
  };

function Banner({ className, variant = "info", icon, title, action, children, ...props }: BannerProps) {
  return (
    <div
      data-slot="banner"
      role={variant === "error" ? "alert" : "status"}
      className={cn(bannerVariants({ variant }), className)}
      {...props}
    >
      <span data-slot="banner-icon" className="shrink-0">
        <Icon name={icon ?? defaultIcon[variant ?? "info"]} size={22} />
      </span>
      <div className="min-w-[180px] flex-1">
        {title && <span className="font-medium">{title}</span>} {children}
      </div>
      {action && <div className="shrink-0 [&_button]:text-current">{action}</div>}
    </div>
  );
}

export { Banner, bannerVariants };
