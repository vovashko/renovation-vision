import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { useFormat, useStatusLabel } from "@/i18n";
import { getAiAnswer, type AiAnswer } from "@/features/knowledge/domain/assistant";
import { useKnowledge } from "@/features/knowledge/hooks/use-knowledge";
import { usePhotos, useProject, useRooms, useStages } from "@/lib/queries";
import { AiSuggestions } from "@/features/knowledge/ui/ai-suggestions";
import { AiAnswerMessage } from "@/features/knowledge/ui/ai-answer";
import { answerText } from "@/features/knowledge/ui/render-answer";
import { AiThinking } from "@/features/knowledge/ui/ai-thinking";
import { AiAskInput } from "@/features/knowledge/ui/ai-ask-input";

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
  const { t } = useTranslation("knowledge");
  const format = useFormat();
  const statusLabel = useStatusLabel();
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || thinking || !ready) return;
    setInput("");
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: q }]);
    setThinking(true);
    const answer = getAiAnswer(q, {
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
    const text = answerText(answer, { t, format, statusLabel });
    const parts = text.split(" ");
    for (let i = 1; i <= parts.length; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const partial = parts.slice(0, i).join(" ");
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: partial } : x)));
    }
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, answer } : x)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-2" aria-live="polite">
        {messages.length === 0 && (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon" icon="smart_toy" />
              <EmptyTitle>{t("assistant.empty.title")}</EmptyTitle>
              <EmptyDescription>{t("assistant.empty.description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <ChatBubble side="sent">{m.text}</ChatBubble>
            </div>
          ) : (
            <AiAnswerMessage
              key={m.id}
              text={m.text}
              answer={m.answer}
              question={m.question}
              projectId={projectId}
              managerName={managerName}
              onAskManager={onAskManager}
            />
          ),
        )}
        {thinking && <AiThinking />}
        <div ref={endRef} />
      </div>

      <div>
        <AiSuggestions onAsk={ask} disabled={thinking || !ready} />
        <p className="px-4 pt-2 text-body-sm text-on-surface-variant">{t("assistant.disclaimer")}</p>
        <AiAskInput
          value={input}
          onChange={setInput}
          onSubmit={() => ask(input)}
          onClear={messages.length > 0 ? () => setMessages([]) : undefined}
          disabled={!input.trim() || thinking || !ready}
        />
      </div>
    </div>
  );
}
