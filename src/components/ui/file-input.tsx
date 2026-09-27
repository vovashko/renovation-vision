import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A native <input type="file">, styled via its ::file-selector-button pseudo-element (Tailwind's
// `file:*` variant) since the input itself can't be restyled cross-browser. `default` is the pill
// button used for image pickers (photo upload, render); `compact` is the smaller box used for a
// receipt attachment.
const fileInputVariants = cva("block w-full file:mr-3 file:border-0", {
  variants: {
    variant: {
      default:
        "text-body-md text-on-surface-variant file:h-10 file:rounded-full file:bg-secondary-container file:px-6 file:text-label-lg file:text-on-secondary-container",
      compact: "text-sm file:min-h-11 file:rounded-md file:bg-muted file:px-4 file:text-sm file:font-medium",
    },
  },
  defaultVariants: { variant: "default" },
});

type FileInputProps = Omit<React.ComponentProps<"input">, "type"> & VariantProps<typeof fileInputVariants>;

function FileInput({ className, variant = "default", ...props }: FileInputProps) {
  return <input type="file" data-slot="file-input" className={cn(fileInputVariants({ variant }), className)} {...props} />;
}

export { FileInput };
