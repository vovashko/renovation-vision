import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** The "no project to show" empty state shared by the home redirect and the project layout guard. */
export function ProjectEmpty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <Empty className="mx-auto mt-10 max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon" icon="folder_off" />
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{text}</EmptyDescription>
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}
