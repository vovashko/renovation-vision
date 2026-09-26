import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// v5 navigation rail (desktop only; phones use the bottom bar). The rail sits in a fixed 96px slot and is
// itself absolutely positioned inside it, so expanding to 240px on hover or keyboard focus overlays the
// page (with shadow-float) instead of pushing it. Items keep their 56px icon cell; labels fade in on expand.

const EASE = "ease-[cubic-bezier(0.2,0,0,1)]";

/** The 96px slot plus the <nav>. `className` lands on the slot (layout); nav props go to the <nav>. */
function Rail({ className, children, "aria-label": ariaLabel = "Main", ...props }: React.ComponentProps<"nav">) {
  return (
    <TooltipProvider delayDuration={300}>
      <div data-slot="rail" className={cn("sticky top-4 z-40 m-4 mr-0 hidden h-[calc(100dvh-2rem)] w-24 shrink-0 md:block", className)}>
        <nav
          aria-label={ariaLabel}
          className={cn(
            "group/rail absolute inset-y-0 left-0 z-20 flex w-24 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-card px-5 py-5 transition-[width,box-shadow] duration-[220ms] focus-within:w-60 focus-within:shadow-float hover:w-60 hover:shadow-float motion-reduce:transition-none",
            EASE,
          )}
          {...props}
        >
          {children}
        </nav>
      </div>
    </TooltipProvider>
  );
}

/** Top slot, usually a <RailLogo>. */
function RailHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="rail-header" className={cn("mb-4 shrink-0", className)} {...props} />;
}

/** Scrollable item list. Put a trailing group (Settings) in `<RailGroup position="end">`. */
function RailContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="rail-content"
      className={cn("-mx-5 flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-2 overflow-x-hidden overflow-y-auto px-5", className)}
      {...props}
    />
  );
}

const railGroupVariants = cva("flex flex-col gap-2", {
  variants: { position: { start: "", end: "mt-auto" } },
  defaultVariants: { position: "start" },
});

/** A run of items. `position="end"` pushes the group to the bottom of the content (Settings). */
function RailGroup({ className, position, ...props }: React.ComponentProps<"div"> & { position?: "start" | "end" }) {
  return <div data-slot="rail-group" className={cn(railGroupVariants({ position }), className)} {...props} />;
}

/** Bottom slot (the profile avatar), below a hairline divider. */
function RailFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="rail-footer" className={cn("mt-2 shrink-0 border-t border-outline-variant pt-2", className)} {...props} />;
}

function RailSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-slot="rail-separator" className={cn("my-2 bg-outline-variant", className)} {...props} />;
}

// Label fades in once the rail is expanded (hover, or keyboard focus on anything inside it).
const labelClass =
  "min-w-0 truncate pr-4 text-label-lg opacity-0 transition-opacity duration-150 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 motion-reduce:transition-none";

const railItemVariants = cva(
  cn(
    "flex h-14 w-full shrink-0 cursor-pointer items-center rounded-lg text-left whitespace-nowrap text-on-surface transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
    EASE,
  ),
  {
    variants: { active: { true: "bg-surface-container-high", false: "hover:bg-surface" } },
    defaultVariants: { active: false },
  },
);

type RailItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Material Symbols name (24px), or a node such as an avatar. */
  icon: string | React.ReactNode;
  /** Visible label when expanded; also the tooltip and the accessible name. */
  label: string;
  active?: boolean;
  /** Render the given child (a router <Link>, an <a>) instead of a <button>. */
  asChild?: boolean;
  children?: React.ReactNode;
};

/**
 * One 56px rail row: the icon in a fixed 56px cell, then the label that fades in on expand. The label is
 * also the tooltip (shown to the right) and the `aria-label`; pass `aria-label` to override the latter.
 * With `asChild`, the icon cell and label are rendered inside the child element.
 */
function RailItem({ icon, label, active = false, asChild = false, className, children, ...props }: RailItemProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp
          data-slot="rail-item"
          data-active={active}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          {...(asChild ? {} : { type: "button" as const })}
          className={cn(railItemVariants({ active }), className)}
          {...props}
        >
          <span className="grid w-14 shrink-0 place-items-center">{typeof icon === "string" ? <Icon name={icon} size={24} /> : icon}</span>
          <span className={labelClass}>{label}</span>
          <Slottable>{children}</Slottable>
        </Comp>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

type RailLogoProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** 40px square mark, shown while collapsed. */
  mark: string;
  /** 150×40 lockup, cross-faded in as the rail expands. */
  lockup: string;
  /** Render the given child (e.g. a home <Link> with an aria-label) instead of a <div>. */
  asChild?: boolean;
  children?: React.ReactNode;
};

/** The mark → lockup cross-fade. Both images are decorative; label the wrapping link. */
function RailLogo({ mark, lockup, asChild = false, className, children, ...props }: RailLogoProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="rail-logo"
      className={cn(
        "relative block h-10 w-[150px] shrink-0 rounded-md pl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <img
        src={mark}
        alt=""
        width={40}
        height={40}
        className="size-10 transition-opacity duration-150 group-focus-within/rail:opacity-0 group-hover/rail:opacity-0 motion-reduce:transition-none"
      />
      <img
        src={lockup}
        alt=""
        width={150}
        height={40}
        className="absolute top-0 left-2 h-10 w-[150px] max-w-none opacity-0 transition-opacity duration-150 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 motion-reduce:transition-none"
      />
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

export { Rail, RailHeader, RailContent, RailGroup, RailFooter, RailSeparator, RailItem, RailLogo };
