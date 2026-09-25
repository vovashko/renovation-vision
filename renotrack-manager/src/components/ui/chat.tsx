import { forwardRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const words = name.split(" ").filter((w) => /^[a-z]/i.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function ChatAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-label-lg text-on-primary-container", className)}>
      {initials(name)}
    </div>
  );
}

export function PresenceIndicator({ online, label }: { online: boolean; label: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-body-sm", online ? "text-success-text" : "text-on-surface-variant")}>
      <span aria-hidden className={cn("size-2 rounded-full", online ? "bg-success" : "border-2 border-outline")} />
      {online ? "Online" : "Offline"} · {label}
    </div>
  );
}

export function ChatHeader({ name, roleLabel, online, actions }: { name: string; roleLabel: string; online: boolean; actions?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
      <ChatAvatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-title-md">{name}</div>
        <PresenceIndicator online={online} label={roleLabel} />
      </div>
      {actions}
    </div>
  );
}

export function ChatBubble({ mine, author, time, children, attachment }: { mine: boolean; author?: string; time: string; children: ReactNode; attachment?: ReactNode }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] px-3.5 py-2.5 text-body-md ${
          mine ? "rounded-[18px_18px_6px_18px] bg-primary text-on-primary" : "rounded-[18px_18px_18px_6px] bg-card text-on-surface"
        }`}
      >
        {author && <div className={`mb-0.5 text-label-sm ${mine ? "text-primary-container" : "text-on-surface-variant"}`}>{author}</div>}
        {attachment}
        <div className="whitespace-pre-wrap break-words">{children}</div>
        <div className={`mt-1 text-[11px] ${mine ? "text-primary-container" : "text-on-surface-variant"}`}>{time}</div>
      </div>
    </div>
  );
}

/** Pinned composer: attachment button, input, send button. */
export const ChatComposer = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  placeholder: string;
  disabled?: boolean;
  children?: ReactNode;
}>(function ChatComposer({ value, onChange, onSend, onAttach, placeholder, disabled, children }, ref) {
  return (
    <div className="border-t border-outline-variant">
      {children}
      <div className="flex items-center gap-2 pt-3">
        {onAttach && (
          <button type="button" onClick={onAttach} className="state-layer flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="Attach">
            <Icon name="attach_file" size={22} />
          </button>
        )}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary/92 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          aria-label="Send"
        >
          <Icon name="send" size={20} />
        </button>
      </div>
    </div>
  );
});
