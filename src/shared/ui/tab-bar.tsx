import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

// v5 bottom navigation bar (phones only; the desktop nav rail lives in `ui/rail.tsx`). A fixed
// strip of tabs plus "More", each a 64x32 active-indicator pill behind a 24px icon with a label
// below (Material 3 navigation bar). `TabBarRow` is the "More" sheet's full-width row style.

/** The fixed bottom strip. `className` is layout only. */
function TabBar({ className, children, "aria-label": ariaLabel = "Main", ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("fixed inset-x-0 bottom-0 z-40 flex bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden", className)}
      {...props}
    >
      {children}
    </nav>
  );
}

const tabBarItemVariants = cva(
  "group flex h-20 flex-1 flex-col items-center justify-center gap-1 text-label-md focus-visible:outline-none",
  { variants: { active: { true: "text-on-surface", false: "text-on-surface-variant" } }, defaultVariants: { active: false } },
);
const pillVariants = cva(
  "state-layer flex h-8 w-16 items-center justify-center rounded-full group-focus-visible:outline-2 group-focus-visible:outline-primary",
  { variants: { active: { true: "bg-secondary-container text-on-secondary-container", false: "" } }, defaultVariants: { active: false } },
);

type TabBarItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Material Symbols name (24px). */
  icon: string;
  label: string;
  active?: boolean;
  /** Render the given child (a router <Link>) instead of a <button>. */
  asChild?: boolean;
  children?: React.ReactNode;
};

/** One tab: a pill-backed icon with its label below. Without `asChild` it is a type="button" button. */
function TabBarItem({ icon, label, active = false, asChild = false, className, children, ...props }: TabBarItemProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="tab-bar-item"
      aria-current={active ? "page" : undefined}
      {...(asChild ? {} : { type: "button" as const })}
      className={cn(tabBarItemVariants({ active }), className)}
      {...props}
    >
      <span className={pillVariants({ active })}>
        <Icon name={icon} size={24} fill={active} />
      </span>
      {label}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

const tabBarRowVariants = cva(
  "state-layer flex h-14 w-full items-center gap-3 rounded-full pr-6 pl-4 text-left text-label-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
  {
    variants: { active: { true: "bg-secondary-container text-on-secondary-container", false: "text-on-surface-variant" } },
    defaultVariants: { active: false },
  },
);

type TabBarRowProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Material Symbols name, or a node such as an avatar. */
  icon: string | React.ReactNode;
  active?: boolean;
  /** Render the given child (a router <Link>) instead of a <button>. */
  asChild?: boolean;
  children?: React.ReactNode;
};

/** A full-width row in the "More" sheet: icon + label, rounded-full like an M3 nav-drawer item. */
function TabBarRow({ icon, active = false, asChild = false, className, children, ...props }: TabBarRowProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="tab-bar-row"
      {...(asChild ? {} : { type: "button" as const })}
      className={cn(tabBarRowVariants({ active }), className)}
      {...props}
    >
      {typeof icon === "string" ? <Icon name={icon} size={24} fill={active} /> : icon}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

export { TabBar, TabBarItem, TabBarRow };
