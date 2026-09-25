import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useQueryClient } from "@tanstack/react-query";
import { ChatBubble, ChatComposer, ChatHeader } from "@/components/ui/chat";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useMessages, useProject, useSave } from "@/lib/queries";
import { timeLabel } from "@/lib/format";

export const Route = createFileRoute("/projects/$projectId/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Renovision Manager" },
      { name: "description", content: "Chat with your client in real time." },
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
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useSave(projectId, (v: { body: string; file: File | null }) => api.sendMessage(projectId, v.body, v.file), { invalidate: [keys.messages(projectId)] });

  useEffect(() => api.subscribeMessages(projectId, () => void qc.invalidateQueries({ queryKey: keys.messages(projectId) })), [projectId, qc]);
  useEffect(() => {
    if (!userId || !profile) return;
    return api.joinPresence(projectId, { id: userId, name: profile.full_name, role: "manager" }, setOnline);
  }, [projectId, userId, profile]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages?.length) void api.markChatRead(projectId);
  }, [messages, projectId]);

  if (isLoading || !messages) return <PageLoading />;

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profile.full_name ?? "Former member";
  const clients = members.filter((m) => m.role === "client");
  const clientOnline = clients.some((c) => online.includes(c.user_id));
  const submit = () => {
    if (!text.trim() && !file) return;
    send.mutate({ body: text.trim(), file }, { onSuccess: () => { setText(""); setFile(null); } });
  };

  let lastDay = "";
  return (
    <div className="fixed inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+4.5rem)] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex flex-col overflow-hidden bg-surface-container-high p-4 text-on-surface md:static md:mx-auto md:h-[calc(100dvh-9rem)] md:w-full md:max-w-3xl md:rounded-xl">
      <ChatHeader
        name={project?.client_name || clients.map((c) => c.profile.full_name).join(" & ") || "Client"}
        roleLabel={clients.length ? `Client · ${clients.length} member${clients.length > 1 ? "s" : ""}` : "No client invited yet"}
        online={clientOnline}
      />

      <div className="flex-1 space-y-2 overflow-y-auto py-4" aria-live="polite">
        {messages.length === 0 && <EmptyState icon="chat_bubble" text="No messages yet. Say hello — your client gets a notification." className="border-0" />}
        {messages.map((m) => {
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.sender_id === userId;
          return (
            <div key={m.id}>
              {showDay && <div className="my-3 text-center text-label-md text-on-surface-variant">{day}</div>}
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
      <ChatComposer value={text} onChange={setText} onSend={submit} onAttach={() => fileRef.current?.click()} placeholder="Message your client…" disabled={send.isPending || (!text.trim() && !file)}>
        {file && (
          <div className="flex items-center gap-2 pt-3 text-body-md">
            <span className="truncate rounded-full bg-surface-container-lowest px-3 py-1">{file.name}</span>
            <button onClick={() => setFile(null)} aria-label="Remove attachment" className="state-layer grid size-10 place-items-center rounded-full text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"><Icon name="close" size={20} /></button>
          </div>
        )}
      </ChatComposer>
    </div>
  );
}
