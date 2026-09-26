import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// Accepts a Material Symbols name (new) or a lucide component (old), so callers this task
// doesn't own keep working. See PR "Needs follow-up" for converting the rest to the string API.
type EmptyStateIcon = string | LucideIcon;

function isSymbolName(icon: EmptyStateIcon): icon is string {
  return typeof icon === "string";
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: EmptyStateIcon;
  title?: string;
  text: string;
  action?: ReactNode;
  className?: string;
}) {
  const LegacyIcon = isSymbolName(icon) ? null : icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        {isSymbolName(icon) ? <Icon name={icon} size={24} /> : LegacyIcon && <LegacyIcon className="h-6 w-6" />}
      </div>
      {title && <h3 className="mt-3 text-title-md text-on-surface">{title}</h3>}
      <p className="mt-2 max-w-xs text-body-md text-on-surface-variant">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
