import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { project } from "@/lib/renovation-data";
import { AiChat } from "@/components/ai-chat";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — RenoTrack" },
      {
        name: "description",
        content: "Chat with your renovation manager or ask the AI assistant about your project.",
      },
      { property: "og:title", content: "Chat — RenoTrack" },
      {
        property: "og:description",
        content: "Chat with your renovation manager or ask the AI assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Msg = { id: number; from: "me" | "manager"; text: string; time: string };

const initial: Msg[] = [
  {
    id: 1,
    from: "manager",
    text: `Hi! Quick update — drywall is done in the living room. We're starting flooring tomorrow.`,
    time: "09:14",
  },
  { id: 2, from: "me", text: "Great news! Did the oak planks arrive?", time: "09:18" },
  {
    id: 3,
    from: "manager",
    text: "Yes, delivered this morning. Quality looks excellent.",
    time: "09:20",
  },
  {
    id: 4,
    from: "manager",
    text: "Heads up: Bedroom 2 is blocked — waiting on the electrical inspector. Will follow up today.",
    time: "09:21",
  },
  { id: 5, from: "me", text: "Thanks Jonas, keep me posted.", time: "09:25" },
];

function ChatPage() {
  const [tab, setTab] = useState<"manager" | "ai">("manager");
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboard = useKeyboardInset();
  // Mobile: pin the panel between the header and the tab bar, or above the keyboard while typing.
  const mobileBottom = keyboard.inset
    ? `${keyboard.inset}px`
    : keyboard.open
      ? "0px"
      : "calc(3.5rem + 1px + env(safe-area-inset-bottom))";

  useEffect(() => {
    if (tab === "manager") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, tab]);

  const send = () => {
    if (!text.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((m) => [...m, { id: Date.now(), from: "me", text, time }]);
    setText("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          from: "manager",
          text: "Got it — I'll check and reply shortly.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1200);
  };

  const handOver = (q: string) => {
    setText(q ? `Hi Jonas, question: ${q}` : "");
    setTab("manager");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const tabCls = (active: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-card text-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground"}`;

  return (
    <div
      style={{ "--chat-bottom": mobileBottom } as React.CSSProperties}
      className="fixed inset-x-0 bottom-[var(--chat-bottom)] top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-20 flex flex-col overflow-hidden bg-card md:static md:mx-auto md:h-[calc(100dvh-8.5rem)] md:w-full md:max-w-3xl md:rounded-2xl md:border md:shadow-[var(--shadow-elegant)]"
    >
      <div className="border-b bg-background/60 p-3 backdrop-blur">
        <div
          role="tablist"
          aria-label="Chat mode"
          className="flex gap-1 rounded-full bg-muted p-1"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const nextTab = tab === "manager" ? "ai" : "manager";
            setTab(nextTab);
            document.getElementById(`chat-tab-${nextTab}`)?.focus();
          }}
        >
          <button
            id="chat-tab-manager"
            role="tab"
            aria-selected={tab === "manager"}
            aria-controls="chat-panel"
            tabIndex={tab === "manager" ? 0 : -1}
            onClick={() => setTab("manager")}
            className={tabCls(tab === "manager")}
          >
            <Icon name="person" size={18} /> Site manager
          </button>
          <button
            id="chat-tab-ai"
            role="tab"
            aria-selected={tab === "ai"}
            aria-controls="chat-panel"
            tabIndex={tab === "ai" ? 0 : -1}
            onClick={() => setTab("ai")}
            className={tabCls(tab === "ai")}
          >
            <Icon name="smart_toy" size={18} /> Ask AI
          </button>
        </div>
      </div>

      <div
        id="chat-panel"
        role="tabpanel"
        aria-labelledby={`chat-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === "ai" ? (
          <AiChat onAskManager={handOver} />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] font-semibold text-primary-foreground">
                {project.manager
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <div className="font-semibold">{project.manager}</div>
                <div className="text-xs text-status-done">● Online — Site manager</div>
              </div>
            </div>

            <div
              className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
              aria-live="polite"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-[var(--shadow-soft)] ${
                      m.from === "me"
                        ? "rounded-br-sm bg-[image:var(--gradient-primary)] text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground"
                    }`}
                  >
                    <div>{m.text}</div>
                    <div
                      className={`mt-1 text-[11px] ${m.from === "me" ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {m.time}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 border-t bg-background/60 p-3 backdrop-blur">
              <button
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Attach"
              >
                <Icon name="attach_file" />
              </button>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Message your manager…"
                aria-label="Message your manager"
                className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring md:text-sm"
              />
              <button
                onClick={send}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-soft)]"
                aria-label="Send"
              >
                <Icon name="send" size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
