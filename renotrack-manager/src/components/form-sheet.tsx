import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[90dvh] overflow-y-auto md:max-h-none">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div>{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Same box as <Input> so selects and text fields line up.
export const selectCls =
  "h-11 w-full appearance-none rounded-md border border-outline-variant bg-surface-container-lowest pr-11 pl-4 text-body-md text-on-surface focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary";

/**
 * Native <select> (keeps the platform picker and accessibility) in the text-field box, with the
 * design system's expand_more icon instead of the browser's arrows.
 */
export function NativeSelect({ className, wrapperClassName, ...props }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select className={cn(selectCls, className)} {...props} />
      <Icon name="expand_more" size={22} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-on-surface-variant" />
    </div>
  );
}

export function VisibleSwitch({ id, checked, onChange, label = "Visible to client" }: { id: string; checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3">
      <Label htmlFor={id} className="font-normal">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
