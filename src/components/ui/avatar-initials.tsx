import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A round tile of initials for contexts with no photo. `ui/avatar.tsx` (the Radix shadcn avatar)
// has no tone variant to reuse here without editing it, so this is our own small primitive —
// generic enough for a chat header, a member row, or any other initials fallback.
const avatarInitialsVariants = cva("flex size-10 shrink-0 items-center justify-center rounded-full text-title-md", {
  variants: {
    tone: {
      // White fill, for sitting on a tinted panel (the chat header).
      surface: "bg-surface-container-lowest text-on-surface",
      "primary-container": "bg-primary-container text-on-primary-container",
    },
  },
  defaultVariants: { tone: "surface" },
});

type AvatarInitialsProps = React.ComponentProps<"span"> &
  VariantProps<typeof avatarInitialsVariants> & {
    /** Pre-computed initials text, e.g. from `initials(name)`. */
    initials: string;
  };

function AvatarInitials({ className, tone = "surface", initials, ...props }: AvatarInitialsProps) {
  return (
    <span aria-hidden data-slot="avatar-initials" className={cn(avatarInitialsVariants({ tone }), className)} {...props}>
      {initials}
    </span>
  );
}

export { AvatarInitials };
