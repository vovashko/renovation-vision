import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Used across manager, media, knowledge and project sheets — a generic editing-panel shell, not
// manager-specific, hence living here rather than under components/manager/.

/** Editing panel: bottom sheet on phones, side sheet on desktop (same pattern as the client app's upload sheet). */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive" className="max-h-[90dvh] overflow-y-auto md:max-h-none">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div>{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function VisibleSwitch({
  id,
  checked,
  onChange,
  label = "Visible to client",
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
