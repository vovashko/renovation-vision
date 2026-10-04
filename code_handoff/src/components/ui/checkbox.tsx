import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Icon } from "@/components/ui/icon";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid size-[22px] shrink-0 place-content-center rounded-[7px] border-[1.5px] border-outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-on-primary",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
      <Icon name="check" size={16} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

/**
 * Read-only checkbox (the client's view of a checklist): a grey tile with a check instead of the
 * forest fill, a dashed box when open, no hover or focus. Not interactive, so it is not a Radix Root.
 */
function CheckboxReadOnly({ checked, className, ...props }: { checked: boolean } & React.HTMLAttributes<HTMLSpanElement>) {
  return checked ? (
    <span
      role="img"
      aria-label={undefined}
      className={cn("grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-surface-container-highest text-on-secondary-container", className)}
      {...props}
    >
      <Icon name="check" size={16} />
    </span>
  ) : (
    <span aria-hidden className={cn("size-[22px] shrink-0 rounded-[7px] border-[1.5px] border-dashed border-outline", className)} {...props} />
  );
}

export { Checkbox, CheckboxReadOnly };
