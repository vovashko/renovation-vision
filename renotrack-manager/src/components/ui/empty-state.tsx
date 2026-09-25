import { Icon } from "./icon";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `icon` is a Material Symbols name, e.g. "photo_camera". */
export function EmptyState({ icon, title, text, action, className }: { icon: string; title?: string; text: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed bg-card p-8 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Icon name={icon} size={24} className="text-muted-foreground" /></div>
      {title && <h3 className="mt-3 font-semibold">{title}</h3>}
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
