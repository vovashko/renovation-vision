import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-4 text-body-md text-on-surface transition-colors file:border-0 file:bg-transparent file:text-label-lg file:text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
