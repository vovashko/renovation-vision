/** "Thinking…" indicator shown while the assistant streams an answer. */
export function AiThinking() {
  return (
    <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant" aria-label="Assistant is thinking">
      <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
      <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
      <span className="size-2 animate-bounce rounded-full bg-primary" />
      <span className="ml-1">Thinking…</span>
    </div>
  );
}
