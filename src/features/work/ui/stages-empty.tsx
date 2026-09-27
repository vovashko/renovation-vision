import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function StagesEmpty({ className }: { className?: string }) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon="checklist" />
        <EmptyTitle>No stages yet</EmptyTitle>
        <EmptyDescription>Add the first stage — demolition, electrical, flooring — with its dates.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
