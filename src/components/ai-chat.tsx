import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Send, Trash2, UserRound } from "lucide-react";
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
    // simulated streaming
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
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground">
              <Bot className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-semibold">Ask about your renovation</h2>
            <p className="mt-1 text-sm text-muted-foreground">Answers come from your project's stages, plan, budget and photos.</p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[image:var(--gradient-primary)] px-4 py-2 text-sm text-primary-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] text-sm">
              <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>
              {m.answer && (
                <div className="mt-2 space-y-2">
                  <div className="text-xs text-muted-foreground">Based on: {m.answer.sources.join(" · ")}</div>
                  <div className="flex flex-wrap gap-2">
                    {m.answer.links.map((l) => (
                      <Link
                        key={l.label}
                        to={(l.section ? `/projects/$projectId/${l.section}` : "/projects/$projectId") as "/projects/$projectId"}
                        params={{ projectId }}
                        className="inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium text-primary hover:bg-muted"
                      >
                        {l.label} →
                      </Link>
                    ))}
                    <button
                      onClick={() => onAskManager(m.question ?? "")}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium hover:bg-muted"
                    >
                      <UserRound className="h-3.5 w-3.5" /> Ask {managerName} about this
                    </button>
                  </div>
                </div>
              )}
            </div>
          ),
        )}
        {thinking && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Assistant is thinking">
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            <span className="ml-1">Thinking…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t bg-background/60 backdrop-blur">
        <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-3 pt-3" aria-label="Suggested questions">
          {suggestedQuestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={thinking || !ready}
              className="min-h-10 shrink-0 rounded-full border bg-card px-3 text-sm whitespace-nowrap hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <p className="px-3 pt-2 text-xs text-muted-foreground">
          AI answers are based on project data. For decisions, confirm with your site manager.
        </p>
        <form
          className="flex items-center gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              aria-label="Clear chat"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your project…"
            aria-label="Ask the AI assistant"
            className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring md:text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking || !ready}
            aria-label="Send question"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
