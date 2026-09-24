import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v5 cards: 20px corners, no shadow. Default is white with a hairline border; `tinted` groups
// controls (selected room, chat); `deep` holds charts. `attention` adds the orange outline and
// dot for over budget / late. Padding defaults to p-5; override per use.
const cardVariants = cva("relative rounded-xl p-5 text-on-surface", {
  variants: {
    variant: {
      default: "border border-outline-variant bg-card",
      tinted: "bg-surface-container-high",
      deep: "bg-tertiary-container text-on-tertiary-container",
      // v2 names kept for existing callers
      outlined: "border border-outline-variant bg-card",
      filled: "border border-outline-variant bg-card",
      elevated: "border border-outline-variant bg-card",
    },
    attention: {
      true: "border border-attention-outline after:absolute after:right-4 after:top-4 after:size-2 after:rounded-full after:bg-attention after:content-['']",
      false: "",
    },
    interactive: {
      true: "cursor-pointer transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      false: "",
    },
  },
  defaultVariants: { variant: "default", attention: false, interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, attention, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, attention, interactive }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-title-md text-on-surface", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-body-md text-on-surface-variant", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("pt-4", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center pt-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
