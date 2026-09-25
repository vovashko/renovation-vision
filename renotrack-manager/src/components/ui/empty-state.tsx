import { Icon } from "./icon";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `icon` is a Material Symbols name, e.g. "photo_camera". */
export function EmptyState({ icon, title, text, action, className }: { icon: string; title?: string; text: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-card p-8 text-center text-on-surface", className)}>
      <div className="grid size-12 place-items-center rounded-full bg-surface-container-high text-on-surface-variant"><Icon name={icon} size={24} /></div>
      {title && <h3 className="mt-3 text-title-md">{title}</h3>}
      <p className="mt-2 max-w-xs text-body-md text-on-surface-variant">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
