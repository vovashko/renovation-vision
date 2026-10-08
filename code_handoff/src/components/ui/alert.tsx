import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// v5 alert: an inline message inside a form or card. 16px corners, 20px leading icon, title-sm body-md.
const alertVariants = cva("flex w-full gap-3 rounded-lg border px-4 py-3.5 text-body-md", {
  variants: {
    variant: {
      default:
        "border-outline-variant bg-surface-container-lowest text-on-surface [&_[data-slot=alert-icon]]:text-on-surface-variant [&_[data-slot=alert-description]]:text-on-surface-variant",
      success:
        "border-success-container bg-success-container text-on-success-container [&_[data-slot=alert-icon]]:text-success-text",
      destructive: "border-error-container bg-error-container text-on-error-container [&_[data-slot=alert-icon]]:text-error",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const defaultIcon = { default: "info", success: "check_circle", destructive: "error" } as const;

type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    /** Material Symbols name; defaults per variant. Pass `null` for no icon. */
    icon?: string | null;
  };

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", icon, children, ...props }, ref) => {
  const name = icon === undefined ? defaultIcon[variant ?? "default"] : icon;
  return (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {name && (
        <span data-slot="alert-icon" className="shrink-0">
          <Icon name={name} size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h5 ref={ref} data-slot="alert-title" className={cn("text-label-lg", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <div ref={ref} data-slot="alert-description" className={cn("mt-0.5 text-body-md", className)} {...props} />,
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
