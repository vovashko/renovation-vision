import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { getAiAnswer, suggestedQuestions, type AiAnswer } from "@/lib/ai-assistant";
import { useKnowledge, usePhotos, useProject, useRooms, useStages } from "@/lib/queries";

type AiMsg = { id: number; role: "user" | "ai"; text: string; answer?: AiAnswer; question?: string };

export function AiChat({
  projectId,
  managerName,
  onAskManager,
}: {
  projectId: string;
  managerName: string;
  onAskManager: (q: string) => void;
}) {
  const { data: project } = useProject(projectId);
  const { data: stages } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const { data: photos } = usePhotos(projectId);
  const { data: knowledge } = useKnowledge(projectId);
  const ready = !!project && !!stages && !!rooms;
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || thinking || !ready) return;
    setInput("");
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: q }]);
    setThinking(true);
    const answer = await getAiAnswer(q, {
      project: project!,
      stages: stages!,
      rooms: rooms!,
      photos: photos ?? [],
      knowledge: knowledge ?? [],
    });
    await new Promise((r) => setTimeout(r, 500));
    setThinking(false);
    const id = Date.now() + 1;
    setMessages((m) => [...m, { id, role: "ai", text: "", question: q }]);
    // Simulated streaming.
    const words = answer.text.split(" ");
    for (let i = 1; i <= words.length; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const partial = words.slice(0, i).join(" ");
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: partial } : x)));
    }
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, answer } : x)));
    inputRef.current?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-2" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-on-primary">
              <Icon name="smart_toy" size={24} />
            </div>
            <h2 className="mt-3 text-title-md">Ask about your renovation</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">Answers come from your project's stages, plan, budget and photos.</p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[75%] rounded-[18px_18px_6px_18px] bg-primary px-3.5 py-2.5 text-body-md text-on-primary">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] text-body-md text-on-surface">
              <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>
              {m.answer && (
                <div className="mt-2 space-y-2">
                  <div className="text-body-sm text-on-surface-variant">Based on: {m.answer.sources.join(" · ")}</div>
                  <div className="flex flex-wrap gap-2">
                    {m.answer.links.map((l) => (
                      <Link
                        key={l.label}
                        to={(l.section ? `/projects/$projectId/${l.section}` : "/projects/$projectId") as "/projects/$projectId"}
                        params={{ projectId }}
                        className="state-layer inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 text-label-md text-primary"
                      >
                        {l.label} →
                      </Link>
                    ))}
                    <button
                      onClick={() => onAskManager(m.question ?? "")}
                      className="state-layer inline-flex min-h-9 items-center gap-1 rounded-full border border-outline-variant px-3 text-label-md text-on-surface"
                    >
                      <Icon name="person" size={18} /> Ask {managerName} about this
                    </button>
                  </div>
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant" aria-label="Assistant is thinking">
            <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-primary" />
            <span className="ml-1">Thinking…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div>
        <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pt-3" aria-label="Suggested questions">
          {suggestedQuestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={thinking || !ready}
              className="state-layer min-h-9 shrink-0 rounded-full border border-outline-variant bg-card px-3 text-label-md whitespace-nowrap disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <p className="px-4 pt-2 text-body-sm text-on-surface-variant">
          AI answers are based on project data. For decisions, confirm with your site manager.
        </p>
        <form
          className="flex items-center gap-2 p-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              aria-label="Clear chat"
              className="state-layer grid size-11 shrink-0 place-items-center rounded-full text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="delete" size={22} />
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your project…"
            aria-label="Ask the AI assistant"
            className="h-12 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-lg text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary md:text-body-md"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || thinking || !ready} aria-label="Send question">
            <Icon name="send" size={22} />
          </Button>
        </form>
      </div>
    </div>
  );
}
