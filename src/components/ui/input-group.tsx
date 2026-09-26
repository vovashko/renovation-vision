"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// shadcn `input-group`, restyled to v5. The group draws the text-field box (same as <Input>); the
// control inside is borderless and the focus outline moves to the group. `search` is the spec's
// search field: 48px, 16px corners, low surface.
const inputGroupVariants = cva(
  [
    "group/input-group relative flex w-full min-w-0 items-center border border-outline-variant text-body-md text-on-surface transition-colors has-[>textarea]:h-auto",
    // Addon alignment.
    "has-[>[data-align=inline-start]]:[&>input]:pl-2.5",
    "has-[>[data-align=inline-end]]:[&>input]:pr-2.5",
    "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
    "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
    // Focus and error states.
    "has-[[data-slot=input-group-control]:focus-visible]:outline-2 has-[[data-slot=input-group-control]:focus-visible]:-outline-offset-1 has-[[data-slot=input-group-control]:focus-visible]:outline-primary",
    "has-[[data-slot][aria-invalid=true]]:border-error",
    "has-[[data-slot=input-group-control]:disabled]:opacity-50",
  ],
  {
    variants: {
      variant: {
        default: "h-11 rounded-md bg-surface-container-lowest",
        search: "h-12 rounded-lg bg-surface-container-low",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function InputGroup({ className, variant = "default", ...props }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>) {
  return (
    <div
      data-slot="input-group"
      data-variant={variant}
      role="group"
      className={cn(inputGroupVariants({ variant }), className)}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-body-md text-on-surface-variant select-none group-data-[disabled=true]/input-group:opacity-50 group-data-[variant=search]/input-group:text-on-surface",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-4 has-[>button]:ml-[-0.5rem]",
        "inline-end": "order-last pr-3 has-[>button]:mr-[-0.25rem]",
        "block-start": "order-first w-full justify-start px-4 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
        "block-end": "order-last w-full justify-start px-4 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
      },
    },
    defaultVariants: { align: "inline-start" },
  },
);

/** Icon, text or button beside the control. Clicking it focuses the input. */
function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva("gap-1.5 shadow-none", {
  variants: {
    size: {
      sm: "h-8 rounded-md px-3 text-label-md",
      "icon-sm": "size-8 rounded-full px-0",
    },
  },
  defaultVariants: { size: "icon-sm" },
});

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "icon-sm",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> & VariantProps<typeof inputGroupButtonVariants>) {
  return <Button type={type} data-size={size} variant={variant} className={cn(inputGroupButtonVariants({ size }), className)} {...props} />;
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("flex items-center gap-2 text-body-md text-on-surface-variant", className)} {...props} />;
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn("h-full flex-1 rounded-none border-0 bg-transparent focus-visible:outline-0", className)}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-body-md text-on-surface shadow-none placeholder:text-on-surface-variant focus-visible:ring-0 focus-visible:outline-none md:text-body-md",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea };
