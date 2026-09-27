import { Fragment } from "react";
import { ChatBubble, ChatBubbleAttachment, ChatBubbleAuthor, ChatBubbleTime } from "@/components/ui/chat-bubble";
import { DaySeparator } from "@/features/comms/ui/day-separator";
import { cn } from "@/lib/utils";
import { useFormat } from "@/i18n";
import type { DayGroup } from "@/features/comms/domain/chat-format";
import type { Message } from "@/lib/database.types";

// Named at module scope, not as inline literals, so the linter doesn't mistake these
// non-translatable variant/format identifiers for user-facing text.
const SENT_SIDE = "sent";
const RECEIVED_SIDE = "received";
const TIME_STYLE = "time";

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
  const format = useFormat();
  return (
    <>
      {groups.map((group) => (
        // The bucket boundary comes from the pure `chat-format` day label (see its docstring); the
        // separator text shown here is the localized label for the group's first message instead.
        <Fragment key={group.day}>
          <DaySeparator label={format.dayLabel(group.items[0].created_at)} />
          {group.items.map((m) => {
            const mine = m.sender_id === currentUserId;
            const side = mine ? SENT_SIDE : RECEIVED_SIDE;
            const time = format.date(m.created_at, TIME_STYLE);
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <ChatBubble side={side}>
                  {!mine && <ChatBubbleAuthor side={side}>{nameOf(m.sender_id)}</ChatBubbleAuthor>}
                  {m.attachment_url && <ChatBubbleAttachment href={m.attachment_url} src={m.attachment_url} />}
                  <div className="break-words whitespace-pre-wrap">{m.body}</div>
                  <ChatBubbleTime side={side}>{time}</ChatBubbleTime>
                </ChatBubble>
              </div>
            );
          })}
        </Fragment>
      ))}
    </>
  );
}
