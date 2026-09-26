import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v5 cards: 20px corners, never a shadow. Default is white with a hairline border.
const cardVariants = cva("rounded-xl text-on-surface", {
  variants: {
    variant: {
      default: "border border-outline-variant bg-card",
      // Selected-room panel, control groups, chat.
      tinted: "bg-surface-container-high",
      // Chart panels.
      deep: "bg-tertiary-container text-on-tertiary-container",
    },
    // Over budget / late: orange outline plus an 8px dot at the top right.
    attention: { true: "relative border border-attention-outline", false: "" },
    interactive: {
      true: "cursor-pointer transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      false: "",
    },
  },
  defaultVariants: { variant: "default", attention: false, interactive: false },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, attention, interactive, children, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, attention, interactive }), className)} {...props}>
      {attention && <span aria-hidden className="absolute top-4 right-4 size-2 rounded-full bg-attention" />}
      {children}
    </div>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col gap-1 p-5", className)} {...props} />,
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-title-md", className)} {...props} />,
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-body-md text-on-surface-variant", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />,
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
