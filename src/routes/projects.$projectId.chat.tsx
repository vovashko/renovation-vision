import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, UserRound, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatBubble, ChatComposer, ChatHeader } from "@/components/chat";
import { EmptyState } from "@/components/empty-state";
import { AiChat } from "@/components/ai-chat";
import { PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useMessages, useProject, useSave } from "@/lib/queries";
import { timeLabel } from "@/lib/format";

export const Route = createFileRoute("/projects/$projectId/chat")({
  head: () => ({
    meta: [
      { title: "Chat — RenoVision" },
      { name: "description", content: "Chat in real time about the project." },
    ],
  }),
  component: ChatPage,
});

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
}

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
  const send = useSave(projectId, (v: { body: string; file: File | null }) => api.sendMessage(projectId, v.body, v.file), { invalidate: [keys.messages(projectId)] });

  useEffect(() => api.subscribeMessages(projectId, () => void qc.invalidateQueries({ queryKey: keys.messages(projectId) })), [projectId, qc]);
  useEffect(() => {
    if (!userId || !profile) return;
    return api.joinPresence(projectId, { id: userId, name: profile.full_name, role: isManager ? "manager" : "client" }, setOnline);
  }, [projectId, userId, profile, isManager]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages?.length) void api.markChatRead(projectId);
  }, [messages, projectId]);

  if (isLoading || !messages) return <PageLoading />;

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profile.full_name ?? "Former member";
  const clients = members.filter((m) => m.role === "client");
  const managers = members.filter((m) => m.role === "manager");
  // The other side of the conversation: clients for a manager, the site manager for a client.
  const others = isManager ? clients : managers;
  const othersOnline = others.some((c) => online.includes(c.user_id));
  const managerFirstName = (managers[0]?.profile.full_name ?? project?.manager_name ?? "your manager").split(" ")[0];
  const handOver = (q: string) => {
    setText(q ? `Hi ${managerFirstName}, question: ${q}` : "");
    setTab("people");
  };
  const submit = () => {
    if (!text.trim() && !file) return;
    send.mutate({ body: text.trim(), file }, { onSuccess: () => { setText(""); setFile(null); } });
  };

  let lastDay = "";
  return (
    <div className={`-mx-4 -my-4 flex ${isManager ? "h-[calc(100dvh-3.5rem)]" : "h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))]"} flex-col overflow-hidden bg-card md:mx-auto md:my-0 md:h-[calc(100dvh-8rem)] md:w-full md:max-w-3xl md:rounded-2xl md:border md:shadow-[var(--shadow-elegant)]`}>
      {!isManager && (
        <div className="border-b bg-background/60 p-3 backdrop-blur">
          <div role="tablist" aria-label="Chat mode" className="flex gap-1 rounded-full bg-muted p-1">
            {([["people", "Site manager", UserRound], ["ai", "Ask AI", Bot]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === k ? "bg-card text-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isManager && tab === "ai" ? <AiChat projectId={projectId} managerName={managerFirstName} onAskManager={handOver} /> : <>
      <ChatHeader
        name={isManager ? project?.client_name || clients.map((c) => c.profile.full_name).join(" & ") || "Client" : managers.map((m) => m.profile.full_name).join(" & ") || project?.manager_name || "Site manager"}
        roleLabel={isManager ? (clients.length ? `Client · ${clients.length} member${clients.length > 1 ? "s" : ""}` : "No client invited yet") : "Site manager"}
        online={othersOnline}
      />

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <EmptyState icon={MessageCircle} text={isManager ? "No messages yet. Say hello — your client gets a notification." : "No messages yet. Ask your site manager anything about the project."} className="border-0" />}
        {messages.map((m) => {
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.sender_id === userId;
          return (
            <div key={m.id}>
              {showDay && <div className="my-2 text-center text-xs font-medium text-muted-foreground">{day}</div>}
              <ChatBubble
                mine={mine}
                author={mine ? undefined : nameOf(m.sender_id)}
                time={timeLabel(m.created_at)}
                attachment={m.attachment_url && (
                  <a href={m.attachment_url} target="_blank" rel="noopener" className="mb-1 block">
                    <img src={m.attachment_url} alt="Attachment" className="max-h-56 rounded-lg object-cover" />
                  </a>
                )}
              >
                {m.body}
              </ChatBubble>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <ChatComposer value={text} onChange={setText} onSend={submit} onAttach={() => fileRef.current?.click()} placeholder={isManager ? "Message your client…" : "Message your manager…"} disabled={send.isPending || (!text.trim() && !file)}>
        {file && (
          <div className="flex items-center gap-2 px-3 pt-3 text-sm">
            <span className="truncate rounded-full bg-muted px-3 py-1">{file.name}</span>
            <button onClick={() => setFile(null)} aria-label="Remove attachment" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        )}
      </ChatComposer>
      </>}
    </div>
  );
}
