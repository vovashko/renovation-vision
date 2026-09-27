import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";

/** "No messages yet" placeholder, shown in an otherwise empty message list. */
export function ChatEmpty({ icon, description }: { icon: string; description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon={icon} />
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
