import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// shadcn `native-select`, restyled to v5. A real <select>, so phones get the platform picker, in the same
// box as <Input>, with the expand_more glyph drawn over the right edge instead of the browser's arrows.
// `className` goes on the wrapper (layout only: width, margin, flex); everything else goes on the <select>.
const nativeSelectVariants = cva(
  "w-full min-w-0 appearance-none rounded-md border border-outline-variant bg-surface-container-lowest pr-11 pl-4 text-body-md text-on-surface transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed aria-invalid:border-error",
  {
    variants: {
      size: {
        default: "h-11",
        sm: "h-9 pr-10 pl-3",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & VariantProps<typeof nativeSelectVariants>;

function NativeSelect({ className, size = "default", ...props }: NativeSelectProps) {
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn("group/native-select relative w-full has-[select:disabled]:opacity-50", className)}
    >
      <select data-slot="native-select" data-size={size} className={cn(nativeSelectVariants({ size }))} {...props} />
      <Icon
        name="expand_more"
        size={22}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-on-surface-variant group-has-[[data-size=sm]]/native-select:right-2.5"
      />
    </div>
  );
}

// Canvas / CanvasText are CSS system colours: the open picker follows the OS theme on desktop browsers.
function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" className={cn("bg-[Canvas] text-[CanvasText]", className)} {...props} />;
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" className={cn("bg-[Canvas] text-[CanvasText]", className)} {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
