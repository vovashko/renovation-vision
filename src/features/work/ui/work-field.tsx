import type { ReactNode } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

/**
 * Labeled form field for the stage and room edit forms: `ui/field`'s `Field`/`FieldLabel`/
 * `FieldDescription`, with the simple `id`/`label`/`hint` shape the old form-sheet `Field` had.
 */
export function WorkField({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
