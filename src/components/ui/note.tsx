import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A soft, tinted block for a short informational aside (a schedule note, a checklist-vs-progress
// mismatch) — the "tinted callout" pattern repeated across the manager and client overviews.
// `tone="error"` is a form-level error (wrong password, expired link; announced via role="alert"),
// `tone="success"` a confirmation (email sent, password changed).
const noteVariants = cva("rounded-lg", {
  variants: {
    size: {
      default: "px-4 py-3 text-body-md",
      sm: "px-3 py-2 text-body-sm",
    },
    tone: {
      default: "bg-surface-container-low text-on-surface-variant",
      error: "bg-error-container text-on-error-container",
      success: "bg-success-container text-on-success-container",
    },
  },
  defaultVariants: { size: "default", tone: "default" },
});

function Note({ className, size, tone, ...props }: React.ComponentProps<"div"> & VariantProps<typeof noteVariants>) {
  return (
    <div
      data-slot="note"
      role={tone === "error" ? "alert" : tone === "success" ? "status" : undefined}
      className={cn(noteVariants({ size, tone }), className)}
      {...props}
    />
  );
}

export { Note };
