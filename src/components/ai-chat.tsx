import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  defaultProjectData,
  getAiAnswer,
  suggestedQuestions,
  type AiAnswer,
} from "@/lib/ai-assistant";
import { usePhotos } from "@/lib/photo-store";
import { project } from "@/lib/renovation-data";

type AiMsg = {
  id: number;
  role: "user" | "ai";
  text: string;
  answer?: AiAnswer;
  question?: string;
};

export function AiChat({ onAskManager }: { onAskManager: (q: string) => void }) {
  const { photos } = usePhotos();
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  // True from question to end of the streamed answer; blocks overlapping questions.
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const ask = async (question: string, typed = false) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: q }]);
    setThinking(true);
    const answer = await getAiAnswer(q, defaultProjectData(photos));
    await new Promise((r) => setTimeout(r, 500));
    setThinking(false);
    const id = Date.now() + 1;
    setMessages((m) => [...m, { id, role: "ai", text: "", question: q }]);
    // simulated streaming
    const words = answer.text.split(" ");
    for (let i = 1; i <= words.length; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const partial = words.slice(0, i).join(" ");
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: partial } : x)));
    }
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, answer } : x)));
    setBusy(false);
    // Only refocus after a typed question; on phones this would pop the keyboard after chip taps.
    if (typed) inputRef.current?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-2"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface">
              <Icon name="smart_toy" />
            </div>
            <h2 className="mt-3 text-title-md">Ask about your renovation</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Answers come from your project's stages, plan, budget and photos.
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[75%] rounded-[18px_18px_6px_18px] bg-primary px-3.5 py-2.5 text-body-md text-on-primary">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <div className="w-fit whitespace-pre-wrap rounded-[18px_18px_18px_6px] bg-card px-3.5 py-2.5 text-body-md">
                {m.text}
              </div>
              {m.answer && (
                <div className="mt-2 space-y-2">
                  <div className="text-body-sm text-on-surface-variant">
                    Based on: {m.answer.sources.join(" · ")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m.answer.links.map((l) => (
                      <Link
                        key={l.label}
                        to={l.to}
                        className={cn(
                          badgeVariants({ variant: "assist" }),
                          "after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
                        )}
                      >
                        {l.label}
                        <Icon name="arrow_forward" size={16} />
                      </Link>
                    ))}
                    <button
                      onClick={() => onAskManager(m.question ?? "")}
                      className={cn(
                        badgeVariants({ variant: "assist" }),
                        "after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
                      )}
                    >
                      <Icon name="person" size={16} /> Ask {project.manager.split(" ")[0]} about
                      this
                    </button>
                  </div>
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <div
            className="flex items-center gap-1.5 text-body-md text-on-surface-variant"
            aria-label="Assistant is thinking"
          >
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            <span className="ml-1">Thinking…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div>
        <div
          className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
          aria-label="Suggested questions"
        >
          {suggestedQuestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={busy}
              className={cn(
                badgeVariants({ variant: "assist" }),
                "relative shrink-0 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] disabled:opacity-38",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="px-4 text-body-sm text-on-surface-variant">
          AI answers are based on project data. For decisions, confirm with your site manager.
        </p>
        <form
          className="flex items-center gap-2 p-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input, true);
          }}
        >
          {messages.length > 0 && (
            <Button
              type="button"
              variant="surface"
              size="icon"
              onClick={() => setMessages([])}
              aria-label="Clear chat"
            >
              <Icon name="delete" size={22} />
            </Button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your project…"
            aria-label="Ask the AI assistant"
            className="h-12 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-lg text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary md:text-body-md"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || busy}
            aria-label="Send question"
          >
            <Icon name="send" size={22} />
          </Button>
        </form>
      </div>
    </div>
  );
}
