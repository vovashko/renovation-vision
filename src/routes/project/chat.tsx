import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { ChatHeader } from "@/features/comms/ui/chat-header";
import { ChatModeTabs, type ChatMode } from "@/features/comms/ui/chat-mode-tabs";
import { MessageList } from "@/features/comms/ui/message-list";
import { ChatComposer } from "@/features/comms/ui/chat-composer";
import { ChatEmpty } from "@/features/comms/ui/chat-empty";
import { AiChat } from "@/features/knowledge/ui/ai-chat";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useNavRole } from "@/shared/ui/nav-role";
import { useProject } from "@/features/projects/hooks";
import { useMembers } from "@/features/people/hooks";
import { groupMessagesByDay } from "@/features/comms/domain/chat-format";
import { canSendMessage } from "@/features/comms/domain/schemas";
import { useChatRealtime } from "@/features/comms/hooks/use-chat-realtime";
import { useMarkChatRead, useMessages, useSendMessage } from "@/features/comms/hooks/use-messages";
import { usePresence, type PresenceMember } from "@/features/comms/hooks/use-presence";
import { useKeyboardInset } from "@/features/comms/hooks/use-keyboard-inset";

const CHAT_PANEL_ID = "chat-panel";

export const Route = createFileRoute("/_authed/projects/$projectId/chat")({
  head: () => ({
    meta: [{ title: "Chat — RenoVision" }, { name: "description", content: "Chat in real time about the project." }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation(["comms", "common"]);
  const { userId, profile } = useAuth();
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: messages, isLoading } = useMessages(projectId);
  const isManager = useNavRole() === "manager";
  const [tab, setTab] = useState<ChatMode>("people");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyboard = useKeyboardInset();
  const send = useSendMessage(projectId);
  const markRead = useMarkChatRead(projectId);

  const me: PresenceMember | null =
    userId && profile ? { id: userId, name: profile.full_name, role: isManager ? "manager" : "client" } : null;
  const online = usePresence(projectId, me);

  // Mobile: pin the panel between the header and the phone bottom bar (both roles have one now), or
  // above the on-screen keyboard while typing.
  const mobileBottom = keyboard.inset ? `${keyboard.inset}px` : keyboard.open ? "0px" : "calc(5rem + env(safe-area-inset-bottom))";

  useChatRealtime(projectId);
  useEffect(() => {
    if (tab !== "people") return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages?.length) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, tab]);

  if (isLoading || !messages) return <PageLoading />;

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profile.full_name ?? t("chat.header.formerMember");
  const clients = members.filter((m) => m.role === "client");
  const managers = members.filter((m) => m.role === "manager");
  // The other side of the conversation: clients for a manager, the site manager for a client.
  const others = isManager ? clients : managers;
  const othersOnline = others.some((c) => online.includes(c.user_id));
  const otherName = isManager
    ? project?.client_display_name || clients.map((c) => c.profile.full_name).join(" & ") || t("chat.header.defaultClientName")
    : managers.map((m) => m.profile.full_name).join(" & ") || project?.manager_name || t("chat.header.defaultManagerName");
  const otherRole = isManager
    ? clients.length
      ? t("chat.header.clientRole", { count: clients.length })
      : t("chat.header.noClientInvited")
    : t("chat.header.defaultManagerName");
  const managerFirstName = (managers[0]?.profile.full_name ?? project?.manager_name ?? t("chat.header.defaultManagerName")).split(" ")[0];

  const handOver = (q: string) => {
    setText(q ? t("chat.handOverTemplate", { name: managerFirstName, question: q }) : "");
    setTab("people");
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const submit = () => {
    if (!canSendMessage(text, !!file)) return;
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
      {!isManager && <ChatModeTabs mode={tab} onChange={setTab} panelId={CHAT_PANEL_ID} />}

      <div
        id={CHAT_PANEL_ID}
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
                  description={isManager ? t("chat.empty.managerDescription") : t("chat.empty.clientDescription")}
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
              placeholder={isManager ? t("chat.composer.managerPlaceholder") : t("chat.composer.clientPlaceholder")}
              disabled={send.isPending || !canSendMessage(text, !!file)}
              attachment={file ? { name: file.name, onRemove: () => setFile(null) } : undefined}
            />
          </>
        )}
      </div>
    </Card>
  );
}
