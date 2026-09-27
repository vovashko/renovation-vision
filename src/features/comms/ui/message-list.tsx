import { Fragment } from "react";
import { ChatBubble, ChatBubbleAttachment, ChatBubbleAuthor, ChatBubbleTime } from "@/components/ui/chat-bubble";
import { DaySeparator } from "@/features/comms/ui/day-separator";
import { cn } from "@/lib/utils";
import { timeLabel } from "@/lib/format";
import type { DayGroup } from "@/lib/chat-format";
import type { Message } from "@/lib/database.types";

/** Day-grouped message bubbles, mine on the right, everyone else's on the left. */
export function MessageList({
  groups,
  currentUserId,
  nameOf,
}: {
  groups: DayGroup<Message>[];
  currentUserId: string | null | undefined;
  /** Sender display name, shown above a received bubble (e.g. a manager's group of clients). */
  nameOf: (id: string) => string;
}) {
  return (
    <>
      {groups.map((group) => (
        <Fragment key={group.day}>
          <DaySeparator label={group.day} />
          {group.items.map((m) => {
            const mine = m.sender_id === currentUserId;
            const side = mine ? "sent" : "received";
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <ChatBubble side={side}>
                  {!mine && <ChatBubbleAuthor side={side}>{nameOf(m.sender_id)}</ChatBubbleAuthor>}
                  {m.attachment_url && <ChatBubbleAttachment href={m.attachment_url} src={m.attachment_url} />}
                  <div className="break-words whitespace-pre-wrap">{m.body}</div>
                  <ChatBubbleTime side={side}>{timeLabel(m.created_at)}</ChatBubbleTime>
                </ChatBubble>
              </div>
            );
          })}
        </Fragment>
      ))}
    </>
  );
}
