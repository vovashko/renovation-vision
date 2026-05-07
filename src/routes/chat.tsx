import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";
import { project } from "@/lib/renovation-data";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — RenoTrack" },
      { name: "description", content: "Chat with your renovation manager." },
    ],
  }),
  component: ChatPage,
});

type Msg = { id: number; from: "me" | "manager"; text: string; time: string };

const initial: Msg[] = [
  { id: 1, from: "manager", text: `Hi! Quick update — drywall is done in the living room. We're starting flooring tomorrow.`, time: "09:14" },
  { id: 2, from: "me", text: "Great news! Did the oak planks arrive?", time: "09:18" },
  { id: 3, from: "manager", text: "Yes, delivered this morning. Quality looks excellent.", time: "09:20" },
  { id: 4, from: "manager", text: "Heads up: Bedroom 2 is blocked — waiting on the electrical inspector. Will follow up today.", time: "09:21" },
  { id: 5, from: "me", text: "Thanks Jonas, keep me posted.", time: "09:25" },
];

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((m) => [...m, { id: Date.now(), from: "me", text, time }]);
    setText("");
    setTimeout(() => {
      setMessages((m) => [...m, {
        id: Date.now() + 1,
        from: "manager",
        text: "Got it — I'll check and reply shortly.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    }, 1200);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-elegant)]">
      <div className="flex items-center gap-3 border-b bg-background/60 p-4 backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] font-semibold text-primary-foreground">
          {project.manager.split(" ").map(n => n[0]).join("")}
        </div>
        <div>
          <div className="font-semibold">{project.manager}</div>
          <div className="text-xs text-status-done">● Online — Site manager</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-[var(--shadow-soft)] ${
                m.from === "me"
                  ? "rounded-br-sm bg-[image:var(--gradient-primary)] text-primary-foreground"
                  : "rounded-bl-sm bg-muted text-foreground"
              }`}
            >
              <div>{m.text}</div>
              <div className={`mt-1 text-[10px] ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{m.time}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t bg-background/60 p-3 backdrop-blur">
        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Attach">
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message your manager…"
          className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-soft)]"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
