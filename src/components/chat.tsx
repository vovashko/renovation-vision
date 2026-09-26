import { forwardRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const words = name.split(" ").filter((w) => /^[a-z]/i.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function ChatAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-title-md text-on-surface",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export function PresenceIndicator({ online, label }: { online: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
      <span aria-hidden className={cn("size-2 rounded-full", online ? "bg-success" : "bg-on-surface-variant/40")} />
      {online ? "Online" : "Offline"} · {label}
    </div>
  );
}

export function ChatHeader({
  name,
  roleLabel,
  online,
  actions,
}: {
  name: string;
  roleLabel: string;
  online: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ChatAvatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-title-md">{name}</div>
        <PresenceIndicator online={online} label={roleLabel} />
      </div>
      {actions}
    </div>
  );
}

export function ChatBubble({
  mine,
  author,
  time,
  children,
  attachment,
}: {
  mine: boolean;
  author?: string;
  time: string;
  children: ReactNode;
  attachment?: ReactNode;
}) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] px-3.5 py-2.5 text-body-md",
          mine ? "rounded-[18px_18px_6px_18px] bg-primary text-on-primary" : "rounded-[18px_18px_18px_6px] bg-card text-on-surface",
        )}
      >
        {author && (
          <div className={cn("mb-0.5 text-label-sm font-medium", mine ? "text-primary-container" : "text-on-surface-variant")}>
            {author}
          </div>
        )}
        {attachment}
        <div className="break-words whitespace-pre-wrap">{children}</div>
        <div className={cn("mt-1 text-[11px]", mine ? "text-primary-container" : "text-on-surface-variant")}>{time}</div>
      </div>
    </div>
  );
}

/** Pinned composer: attachment button, input, send button. */
export const ChatComposer = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onAttach?: () => void;
    placeholder: string;
    disabled?: boolean;
    children?: ReactNode;
  }
>(function ChatComposer({ value, onChange, onSend, onAttach, placeholder, disabled, children }, ref) {
  return (
    <div>
      {children}
      <div className="flex items-center gap-2 p-4 pt-2">
        {onAttach && (
          <Button type="button" variant="panel" size="icon" onClick={onAttach} aria-label="Attach">
            <Icon name="attach_file" size={22} />
          </Button>
        )}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-lg text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary md:text-body-md"
        />
        <Button type="button" size="icon" onClick={onSend} disabled={disabled} aria-label="Send">
          <Icon name="send" size={22} />
        </Button>
      </div>
    </div>
  );
});
