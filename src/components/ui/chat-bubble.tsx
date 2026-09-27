import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v5 chat bubble (README "Chat"): `sent` is the current user's message (bg-primary), `received`
// is everyone else's, sitting on the tinted chat panel (bg-card, one step lighter). Generic enough
// for any two-party message thread, not just the project chat.
const chatBubbleVariants = cva("max-w-[75%] px-3.5 py-2.5 text-body-md", {
  variants: {
    side: {
      sent: "rounded-[18px_18px_6px_18px] bg-primary text-on-primary",
      received: "rounded-[18px_18px_18px_6px] bg-card text-on-surface",
    },
  },
  defaultVariants: { side: "received" },
});

type ChatBubbleProps = React.ComponentProps<"div"> & VariantProps<typeof chatBubbleVariants>;

function ChatBubble({ className, side = "received", ...props }: ChatBubbleProps) {
  return <div data-slot="chat-bubble" data-side={side} className={cn(chatBubbleVariants({ side }), className)} {...props} />;
}

const chatBubbleTextVariants = cva("", {
  variants: {
    side: { sent: "text-primary-container", received: "text-on-surface-variant" },
  },
  defaultVariants: { side: "received" },
});

type ChatBubbleTextProps = React.ComponentProps<"div"> & VariantProps<typeof chatBubbleTextVariants>;

/** Sender name above a received bubble, shown when the thread has more than two participants. */
function ChatBubbleAuthor({ className, side = "received", ...props }: ChatBubbleTextProps) {
  return (
    <div
      data-slot="chat-bubble-author"
      className={cn("mb-0.5 text-label-sm font-medium", chatBubbleTextVariants({ side }), className)}
      {...props}
    />
  );
}

function ChatBubbleTime({ className, side = "received", ...props }: ChatBubbleTextProps) {
  return <div data-slot="chat-bubble-time" className={cn("mt-1 text-[11px]", chatBubbleTextVariants({ side }), className)} {...props} />;
}

/** Image attachment inside a bubble, opening full-size in a new tab. */
function ChatBubbleAttachment({ href, src, alt = "Attachment" }: { href: string; src: string; alt?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="mb-1 block">
      <img src={src} alt={alt} className="max-h-56 rounded-lg object-cover" />
    </a>
  );
}

export { ChatBubble, ChatBubbleAuthor, ChatBubbleTime, ChatBubbleAttachment };
