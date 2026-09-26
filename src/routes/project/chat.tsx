import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icon";
import { ChatBubble, ChatComposer, ChatHeader } from "@/components/chat";
import { AiChat } from "@/components/ai-chat";
import { PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useMessages, useProject, useSave } from "@/lib/queries";
import { timeLabel } from "@/lib/format";
import { groupMessagesByDay } from "@/lib/chat-format";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$projectId/chat")({
  head: () => ({
    meta: [{ title: "Chat — RenoVision" }, { name: "description", content: "Chat in real time about the project." }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { projectId } = Route.useParams();
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: messages, isLoading } = useMessages(projectId);
  const isManager = profile?.account_type === "manager";
  const [tab, setTab] = useState<"people" | "ai">("people");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboard = useKeyboardInset();
  const send = useSave(projectId, (v: { body: string; file: File | null }) => api.sendMessage(projectId, v.body, v.file), {
    invalidate: [keys.messages(projectId)],
  });

  // Mobile: pin the panel between the header and the tab bar (managers have no mobile tab bar), or
  // above the on-screen keyboard while typing.
  const mobileBottom = keyboard.inset
    ? `${keyboard.inset}px`
    : keyboard.open
      ? "0px"
      : isManager
        ? "env(safe-area-inset-bottom)"
        : "calc(5rem + env(safe-area-inset-bottom))";

  useEffect(
    () => api.subscribeMessages(projectId, () => void qc.invalidateQueries({ queryKey: keys.messages(projectId) })),
    [projectId, qc],
  );
  useEffect(() => {
    if (!userId || !profile) return;
    return api.joinPresence(projectId, { id: userId, name: profile.full_name, role: isManager ? "manager" : "client" }, setOnline);
  }, [projectId, userId, profile, isManager]);
  useEffect(() => {
    if (tab !== "people") return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages?.length) void api.markChatRead(projectId);
  }, [messages, projectId, tab]);

  if (isLoading || !messages) return <PageLoading />;

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profile.full_name ?? "Former member";
  const clients = members.filter((m) => m.role === "client");
  const managers = members.filter((m) => m.role === "manager");
  // The other side of the conversation: clients for a manager, the site manager for a client.
  const others = isManager ? clients : managers;
  const othersOnline = others.some((c) => online.includes(c.user_id));
  const otherName = isManager
    ? project?.client_name || clients.map((c) => c.profile.full_name).join(" & ") || "Client"
    : managers.map((m) => m.profile.full_name).join(" & ") || project?.manager_name || "Site manager";
  const otherRole = isManager
    ? clients.length
      ? `Client · ${clients.length} member${clients.length > 1 ? "s" : ""}`
      : "No client invited yet"
    : "Site manager";
  const managerFirstName = (managers[0]?.profile.full_name ?? project?.manager_name ?? "your manager").split(" ")[0];

  const handOver = (q: string) => {
    setText(q ? `Hi ${managerFirstName}, question: ${q}` : "");
    setTab("people");
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const submit = () => {
    if (!text.trim() && !file) return;
    send.mutate(
      { body: text.trim(), file },
      {
        onSuccess: () => {
          setText("");
          setFile(null);
        },
      },
    );
  };

  // v5 segmented control segment; the ::after extends the tap target to 44px.
  const tabCls = (active: boolean) =>
    cn(
      "relative flex h-7.5 flex-1 items-center justify-center rounded-full px-3.5 text-[13px] transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      active ? "bg-surface-container font-medium text-on-surface" : "text-on-surface hover:bg-on-surface/8",
    );

  const dayGroups = groupMessagesByDay(messages, (m) => m.created_at);

  return (
    <div
      style={{ "--chat-bottom": mobileBottom } as React.CSSProperties}
      className="fixed inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+4.5rem)] bottom-(--chat-bottom) z-20 flex flex-col overflow-hidden bg-surface-container-high text-on-surface md:static md:mx-auto md:h-[calc(100dvh-9rem)] md:w-full md:max-w-3xl md:rounded-xl"
    >
      {!isManager && (
        <div className="px-4 pt-4 pb-2">
          <div
            role="tablist"
            aria-label="Chat mode"
            className="flex rounded-full bg-on-surface/12 p-0.5"
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              const nextTab = tab === "people" ? "ai" : "people";
              setTab(nextTab);
              document.getElementById(`chat-tab-${nextTab}`)?.focus();
            }}
          >
            <button
              id="chat-tab-people"
              role="tab"
              aria-selected={tab === "people"}
              aria-controls="chat-panel"
              tabIndex={tab === "people" ? 0 : -1}
              onClick={() => setTab("people")}
              className={tabCls(tab === "people")}
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
      )}

      <div
        id="chat-panel"
        role={isManager ? undefined : "tabpanel"}
        aria-labelledby={isManager ? undefined : `chat-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {!isManager && tab === "ai" ? (
          <AiChat projectId={projectId} managerName={managerFirstName} onAskManager={handOver} />
        ) : (
          <>
            <ChatHeader name={otherName} roleLabel={otherRole} online={othersOnline} />

            <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-2" aria-live="polite">
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                  <Icon name="chat_bubble" size={24} className="text-on-surface-variant" />
                  <p className="text-body-md text-on-surface-variant">
                    {isManager
                      ? "No messages yet. Say hello — your client gets a notification."
                      : "No messages yet. Ask your site manager anything about the project."}
                  </p>
                </div>
              )}
              {dayGroups.map((group) => (
                <Fragment key={group.day}>
                  <div className="my-3 text-center text-label-md text-on-surface-variant">{group.day}</div>
                  {group.items.map((m) => {
                    const mine = m.sender_id === userId;
                    return (
                      <ChatBubble
                        key={m.id}
                        mine={mine}
                        author={mine ? undefined : nameOf(m.sender_id)}
                        time={timeLabel(m.created_at)}
                        attachment={
                          m.attachment_url && (
                            <a href={m.attachment_url} target="_blank" rel="noopener" className="mb-1 block">
                              <img src={m.attachment_url} alt="Attachment" className="max-h-56 rounded-lg object-cover" />
                            </a>
                          )
                        }
                      >
                        {m.body}
                      </ChatBubble>
                    );
                  })}
                </Fragment>
              ))}
              <div ref={endRef} />
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <ChatComposer
              ref={inputRef}
              value={text}
              onChange={setText}
              onSend={submit}
              onAttach={() => fileRef.current?.click()}
              placeholder={isManager ? "Message your client…" : "Message your manager…"}
              disabled={send.isPending || (!text.trim() && !file)}
            >
              {file && (
                <div className="flex items-center gap-2 px-4 pt-3 text-body-md">
                  <span className="truncate rounded-full bg-surface-container-lowest px-3 py-1">{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    aria-label="Remove attachment"
                    className="state-layer grid size-10 place-items-center rounded-full text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
              )}
            </ChatComposer>
          </>
        )}
      </div>
    </div>
  );
}
