import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { project } from "@/lib/renovation-data";
import { AiChat } from "@/components/ai-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      : "calc(5rem + env(safe-area-inset-bottom))";

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
    cn(
      // v5 segmented control segment; the ::after extends the tap target to 44px.
      "relative flex h-7.5 flex-1 items-center justify-center rounded-full px-3.5 text-[13px] transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] after:-inset-y-[7px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      active
        ? "bg-surface-container font-medium text-on-surface"
        : "text-on-surface hover:bg-on-surface/8",
    );

  return (
    <div
      style={{ "--chat-bottom": mobileBottom } as React.CSSProperties}
      className="fixed inset-x-0 bottom-(--chat-bottom) top-[calc(max(1rem,env(safe-area-inset-top))+4.5rem)] z-20 flex flex-col overflow-hidden bg-surface-container-high text-on-surface md:static md:mx-auto md:h-[calc(100dvh-9rem)] md:w-full md:max-w-7xl md:rounded-xl"
    >
      <div className="px-4 pb-2 pt-4">
        <div
          role="tablist"
          aria-label="Chat mode"
          className="flex rounded-full bg-on-surface/12 p-0.5"
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
            Site manager
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
            Ask AI
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
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex size-10 items-center justify-center rounded-full bg-surface-container-lowest text-title-md text-on-surface"
                aria-hidden
              >
                {project.manager
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <div className="text-title-md">{project.manager}</div>
                <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                  <span className="size-2 rounded-full bg-success" aria-hidden />
                  Online · Site manager
                </div>
              </div>
            </div>

            <div
              className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-2"
              aria-live="polite"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={cn(
                      "max-w-[75%] px-3.5 py-2.5 text-body-md",
                      m.from === "me"
                        ? "rounded-[18px_18px_6px_18px] bg-primary text-on-primary"
                        : "rounded-[18px_18px_18px_6px] bg-card text-on-surface",
                    )}
                  >
                    <div>{m.text}</div>
                    <div
                      className={cn(
                        "mt-1 text-[11px]",
                        m.from === "me" ? "text-primary-container" : "text-on-surface-variant",
                      )}
                    >
                      {m.time}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 p-4 pt-2">
              <Button variant="surface" size="icon" aria-label="Attach">
                <Icon name="attach_file" size={22} />
              </Button>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Message your manager…"
                aria-label="Message your manager"
                className="h-12 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-lg text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary md:text-body-md"
              />
              <Button onClick={send} size="icon" aria-label="Send">
                <Icon name="send" size={22} />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
