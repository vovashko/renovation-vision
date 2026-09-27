import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A small online/offline status dot. Generic enough for a chat header today, and a member row
// or team list tomorrow.
const presenceDotVariants = cva("size-2 shrink-0 rounded-full", {
  variants: {
    online: { true: "bg-success", false: "bg-on-surface-variant/40" },
  },
  defaultVariants: { online: false },
});

function PresenceDot({ className, online, ...props }: React.ComponentProps<"span"> & VariantProps<typeof presenceDotVariants>) {
  return <span aria-hidden data-slot="presence-dot" className={cn(presenceDotVariants({ online }), className)} {...props} />;
}

export { PresenceDot };
