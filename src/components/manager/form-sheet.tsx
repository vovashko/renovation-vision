import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field as FieldPrimitive, FieldLabel, FieldDescription } from "@/components/ui/field";
import { useIsMobile } from "@/hooks/use-mobile";

// Compatibility layer over the `ui/field` and `ui/native-select` primitives (added in T03b), kept so
// pages that haven't moved onto those primitives directly don't break. New code should import
// `Field`/`FieldLabel`/`FieldDescription` from `@/components/ui/field` and `NativeSelect` from
// `@/components/ui/native-select` directly — see `src/components/expense-sheet.tsx` for an example.

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

/**
 * @deprecated Thin wrapper over `ui/field`'s `Field`/`FieldLabel`/`FieldDescription`, kept for pages
 * still on this shape (`id`/`label`/`hint`). New code should compose `ui/field` directly.
 */
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <FieldPrimitive>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </FieldPrimitive>
  );
}

/**
 * @deprecated Same box `ui/native-select`'s default classes render. Kept only for pages still using a
 * raw `<select className={selectCls}>` instead of `<NativeSelect>` from `ui/native-select`.
 */
export const selectCls =
  "h-11 w-full min-w-0 appearance-none rounded-md border border-outline-variant bg-surface-container-lowest pr-11 pl-4 text-body-md text-on-surface transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed aria-invalid:border-error";

/** @deprecated Re-exported for existing imports from this file; import from `@/components/ui/native-select` in new code. */
export { NativeSelect } from "@/components/ui/native-select";

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
