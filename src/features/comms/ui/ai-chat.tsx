import { useEffect, useRef, useState } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { getAiAnswer, suggestedQuestions, type AiAnswer } from "@/lib/ai-assistant";
import { useKnowledge, usePhotos, useProject, useRooms, useStages } from "@/lib/queries";
import { AiSuggestions } from "@/features/comms/ui/ai-suggestions";
import { AiAnswerMessage } from "@/features/comms/ui/ai-answer";
import { AiThinking } from "@/features/comms/ui/ai-thinking";
import { AiAskInput } from "@/features/comms/ui/ai-ask-input";

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
    // Simulated streaming.
    const words = answer.text.split(" ");
    for (let i = 1; i <= words.length; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const partial = words.slice(0, i).join(" ");
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
              <EmptyTitle>Ask about your renovation</EmptyTitle>
              <EmptyDescription>Answers come from your project's stages, plan, budget and photos.</EmptyDescription>
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
        <AiSuggestions questions={suggestedQuestions} onAsk={ask} disabled={thinking || !ready} />
        <p className="px-4 pt-2 text-body-sm text-on-surface-variant">
          AI answers are based on project data. For decisions, confirm with your site manager.
        </p>
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
