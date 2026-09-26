import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v5 buttons: 44px tall, 12px corners, label-lg. A leading <Icon> is 20px (22px in icon buttons).
const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-label-lg transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary/92 active:bg-primary/88",
        tonal: "state-layer bg-secondary-container text-on-secondary-container",
        // Kept for existing callers; same as tonal.
        secondary: "state-layer bg-secondary-container text-on-secondary-container",
        outline: "state-layer border border-outline-variant bg-surface-container-lowest text-on-surface",
        // Buttons on a tinted panel (the design system's stepper card): white, no border, and hover /
        // pressed go to surface instead of a dark state layer, so they stay lighter than the panel.
        panel: "bg-surface-container-lowest text-on-surface hover:bg-surface active:bg-surface",
        ghost: "state-layer bg-transparent px-3 text-primary",
        link: "state-layer bg-transparent px-3 text-primary",
        destructive: "bg-error text-on-error hover:bg-error/92 active:bg-error/88",
      },
      size: {
        default: "",
        sm: "h-9 px-4",
        // Full-width primary action, e.g. "Add room".
        lg: "h-14 w-full text-title-md",
        // Round icon button with a 22px icon. Use variant "outline" on tinted panels
        // (white fill) and "tonal" on white surfaces.
        icon: "size-11 rounded-full px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

/** Count badge for an icon button (the button needs `relative`). */
function ButtonBadge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-success px-1 text-[10px] font-semibold text-white ring-2 ring-white",
        className,
      )}
      {...props}
    />
  );
}

export { Button, ButtonBadge, buttonVariants };
