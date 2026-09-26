import { forwardRef, type ReactNode } from "react";
import { Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const words = name.split(" ").filter((w) => /^[a-z]/i.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function ChatAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] font-semibold text-primary-foreground", className)}>
      {initials(name)}
    </div>
  );
}

export function PresenceIndicator({ online, label }: { online: boolean; label: string }) {
  return (
    <div className={cn("text-xs", online ? "text-status-done" : "text-muted-foreground")}>
      ● {online ? "Online" : "Offline"} — {label}
    </div>
  );
}

export function ChatHeader({ name, roleLabel, online, actions }: { name: string; roleLabel: string; online: boolean; actions?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b p-4">
      <ChatAvatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{name}</div>
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
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-[var(--shadow-soft)] ${
          mine ? "rounded-br-sm bg-[image:var(--gradient-primary)] text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
        }`}
      >
        {author && <div className={`mb-0.5 text-[11px] font-semibold ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{author}</div>}
        {attachment}
        <div className="whitespace-pre-wrap break-words">{children}</div>
        <div className={`mt-1 text-[11px] ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{time}</div>
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
    <div className="border-t bg-background/60 backdrop-blur">
      {children}
      <div className="flex items-center gap-2 p-3">
        {onAttach && (
          <button type="button" onClick={onAttach} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Attach">
            <Paperclip className="h-5 w-5" />
          </button>
        )}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring md:text-sm"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
