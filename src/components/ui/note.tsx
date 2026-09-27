import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A soft, tinted block for a short informational aside (a schedule note, a checklist-vs-progress
// mismatch) — the "tinted callout" pattern repeated across the manager and client overviews.
const noteVariants = cva("rounded-lg bg-surface-container-low text-on-surface-variant", {
  variants: {
    size: {
      default: "px-4 py-3 text-body-md",
      sm: "px-3 py-2 text-body-sm",
    },
  },
  defaultVariants: { size: "default" },
});

function Note({ className, size, ...props }: React.ComponentProps<"div"> & VariantProps<typeof noteVariants>) {
  return <div data-slot="note" className={cn(noteVariants({ size }), className)} {...props} />;
}

export { Note };
