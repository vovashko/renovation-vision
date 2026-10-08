import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// v5 buttons: 44px tall, 12px corners, label-lg. A leading <Icon> is 20px (22px in icon buttons).
const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-label-lg transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none",
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
        // A control sitting directly on a photo (the lightbox nav/close buttons): a dark
        // translucent scrim so it reads against any image, white icon, white focus ring.
        scrim: "bg-black/50 text-white hover:bg-black/60 focus-visible:outline-white",
      },
      size: {
        default: "",
        sm: "h-9 px-4",
        // Full-width primary action, e.g. "Add room".
        lg: "h-14 w-full text-title-md",
        // Round icon button with a 22px icon. Use variant "outline" on tinted panels
        // (white fill) and "tonal" on white surfaces.
        icon: "size-11 rounded-full px-0",
        // Material 3 floating action button: 56px, 16px corners, elevated, pinned above the phone
        // bottom bar with a safe-area gap. The phone-only quick actions trigger (`shared/ui/quick-actions.tsx`).
        fab: "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom)+1rem)] z-40 size-14 rounded-2xl px-0 shadow-float md:hidden",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** 18px ring in the label colour. Static (no spin) when the user prefers reduced motion. */
function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block size-[18px] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none", className)}
    />
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Busy state: the leading <Icon> (or the whole content of an icon/fab button) is swapped for a
   * spinner, a spinner is prepended when there is no leading icon, the fill stays at full strength
   * (unlike disabled) and clicks are ignored. Not supported with `asChild`.
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const busy = loading && !asChild;

    let content = children;
    if (busy) {
      const iconOnly = size === "icon" || size === "fab";
      const items = React.Children.toArray(children);
      const [first, ...rest] = items;
      if (iconOnly) content = <Spinner />;
      else if (React.isValidElement(first) && first.type === Icon) content = [<Spinner key="spinner" />, ...rest];
      else content = [<Spinner key="spinner" />, ...items];
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={busy || undefined}
        aria-disabled={busy || props["aria-disabled"]}
        onClick={busy ? (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault() : onClick}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
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

export { Button, ButtonBadge, buttonVariants, Spinner };
