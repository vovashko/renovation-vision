import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function RoomsEmpty({ className }: { className?: string }) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon="floor" />
        <EmptyTitle>No rooms yet</EmptyTitle>
        <EmptyDescription>Add rooms with their position on the 600×420 plan grid.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
