import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// M3 common buttons. Height and padding live in the base so the `fab` variant can override them.
// A leading Icon (first child) switches to the pl-4 pr-6 layout.
const buttonVariants = cva(
  "state-layer inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-label-lg transition-shadow duration-150 ease-[cubic-bezier(0.2,0,0,1)] has-[>.material-symbols-outlined:first-child]:pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:text-on-surface/38 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Filled
        default:
          "bg-primary text-on-primary hover:shadow-el1 active:shadow-none disabled:bg-on-surface/12",
        tonal:
          "bg-secondary-container text-on-secondary-container hover:shadow-el1 active:shadow-none disabled:bg-on-surface/12",
        // Kept for existing callers; same as tonal.
        secondary:
          "bg-secondary-container text-on-secondary-container hover:shadow-el1 active:shadow-none disabled:bg-on-surface/12",
        outline: "border border-outline bg-transparent text-primary disabled:border-on-surface/12",
        // Text buttons
        ghost:
          "bg-transparent px-3 text-primary has-[>.material-symbols-outlined:first-child]:pl-3",
        link: "bg-transparent px-3 text-primary has-[>.material-symbols-outlined:first-child]:pl-3",
        elevated:
          "bg-surface-container-low text-primary shadow-el1 hover:shadow-el2 disabled:bg-on-surface/12",
        destructive: "bg-error text-on-error hover:shadow-el1 disabled:bg-on-surface/12",
        fab: "size-14 rounded-lg bg-primary-container px-0 text-on-primary-container shadow-el3 hover:shadow-el4 has-[>.material-symbols-outlined:first-child]:pl-0 disabled:bg-on-surface/12",
      },
      size: {
        default: "",
        sm: "h-8 px-4 has-[>.material-symbols-outlined:first-child]:pl-3",
        lg: "h-12 px-8 has-[>.material-symbols-outlined:first-child]:pl-6",
        icon: "size-10 px-0 has-[>.material-symbols-outlined:first-child]:pl-0",
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

export { Button, buttonVariants };
