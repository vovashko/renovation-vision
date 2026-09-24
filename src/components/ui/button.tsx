import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v5 buttons: flat, 44px tall, 12px corners. Leading icons are 20px (22px in icon buttons).
const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-label-lg transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-38 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary/92 active:bg-primary/88",
        tonal: "state-layer bg-secondary-container text-on-secondary-container",
        outline:
          "state-layer border border-outline-variant bg-surface-container-lowest text-on-surface",
        ghost: "state-layer bg-transparent px-3 text-primary",
        link: "state-layer bg-transparent px-3 text-primary",
        destructive: "bg-error text-on-error hover:bg-error/92 active:bg-error/88",
        // White fill for icon buttons that sit on tinted panels.
        surface: "state-layer bg-surface-container-lowest text-on-surface",
        // Kept for existing callers: v5 has no elevation, so these map onto flat variants.
        secondary: "state-layer bg-secondary-container text-on-secondary-container",
        elevated: "state-layer bg-surface-container-lowest text-on-surface",
        fab: "size-14 rounded-lg bg-primary px-0 text-on-primary hover:bg-primary/92 active:bg-primary/88",
      },
      size: {
        default: "",
        sm: "h-9 px-4",
        // Full-width primary action, e.g. "Add room".
        lg: "h-14 w-full text-title-md",
        icon: "size-11 rounded-full px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

/**
 * Unread count on an icon button. The white ring and text are fixed by the v5 spec
 * (`ring-white`, `text-white` on `bg-success`). Place inside a `relative` icon button.
 */
function NotificationBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-success px-1 text-[10px] font-semibold text-white ring-2 ring-white",
        className,
      )}
    >
      {count}
    </span>
  );
}

export { Button, buttonVariants, NotificationBadge };
