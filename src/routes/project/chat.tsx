import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ChatHeader } from "@/features/comms/ui/chat-header";
import { ChatModeTabs, type ChatMode } from "@/features/comms/ui/chat-mode-tabs";
import { MessageList } from "@/features/comms/ui/message-list";
import { ChatComposer } from "@/features/comms/ui/chat-composer";
import { ChatEmpty } from "@/features/comms/ui/chat-empty";
import { AiChat } from "@/features/comms/ui/ai-chat";
import { PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useMessages, useProject, useSave } from "@/lib/queries";
import { groupMessagesByDay } from "@/lib/chat-format";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

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
  const [tab, setTab] = useState<ChatMode>("people");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  const dayGroups = groupMessagesByDay(messages, (m) => m.created_at);

  return (
    <Card
      variant="tinted"
      style={{ "--chat-bottom": mobileBottom } as React.CSSProperties}
      className="fixed inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+4.5rem)] bottom-(--chat-bottom) z-20 flex flex-col overflow-hidden md:static md:mx-auto md:h-[calc(100dvh-9rem)] md:w-full md:max-w-3xl"
    >
      {!isManager && <ChatModeTabs mode={tab} onChange={setTab} panelId="chat-panel" />}

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
                <ChatEmpty
                  icon="chat_bubble"
                  description={
                    isManager
                      ? "No messages yet. Say hello — your client gets a notification."
                      : "No messages yet. Ask your site manager anything about the project."
                  }
                />
              )}
              <MessageList groups={dayGroups} currentUserId={userId} nameOf={nameOf} />
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
              attachment={file ? { name: file.name, onRemove: () => setFile(null) } : undefined}
            />
          </>
        )}
      </div>
    </Card>
  );
}
