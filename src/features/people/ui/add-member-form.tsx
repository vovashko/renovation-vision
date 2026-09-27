import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ProjectRole } from "@/lib/database.types";

/** Invite-by-email row on the Team page, with a Role dropdown (a segmented control was tried; more roles may come). */
export function AddMemberForm({
  email,
  onEmailChange,
  role,
  onRoleChange,
  onSubmit,
  pending,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  role: ProjectRole;
  onRoleChange: (v: ProjectRole) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Card className="p-5">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="tm-email">Add by email</FieldLabel>
          <Input
            id="tm-email"
            type="email"
            required
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            aria-describedby="tm-email-hint"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="tm-role">Role</FieldLabel>
          <NativeSelect id="tm-role" value={role} onChange={(e) => onRoleChange(e.target.value as ProjectRole)}>
            <NativeSelectOption value="client">Client</NativeSelectOption>
            <NativeSelectOption value="manager">Manager</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={!email.trim() || pending} className="gap-2">
          <Icon name="person_add" size={20} /> Add
        </Button>
      </form>
      {/* Below the whole row so the fields and the button share one baseline. */}
      <FieldDescription id="tm-email-hint" className="mt-2">
        They need a RenoVision account first.
      </FieldDescription>
    </Card>
  );
}
