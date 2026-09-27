import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type NewProjectFormState = {
  name: string;
  address: string;
  client_name: string;
  start_date: string;
  target_date: string;
  budget: string;
};

/** The "New project" sheet's form fields. */
export function NewProjectForm({
  form,
  onChange,
  onSubmit,
  saving,
}: {
  form: NewProjectFormState;
  onChange: (form: NewProjectFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
}) {
  const set = (k: keyof NewProjectFormState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="np-name">Project name</FieldLabel>
          <Input id="np-name" required value={form.name} onChange={set("name")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="np-address">Address</FieldLabel>
          <Input id="np-address" value={form.address} onChange={set("address")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="np-client">Client name (as shown in the app)</FieldLabel>
          <Input id="np-client" value={form.client_name} onChange={set("client_name")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="np-start">Start</FieldLabel>
            <Input id="np-start" type="date" value={form.start_date} onChange={set("start_date")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="np-target">Target</FieldLabel>
            <Input id="np-target" type="date" value={form.target_date} onChange={set("target_date")} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="np-budget">Budget ($)</FieldLabel>
          <Input id="np-budget" type="number" min={0} step={100} value={form.budget} onChange={set("budget")} />
        </Field>
        <Button type="submit" disabled={saving || !form.name.trim()} className="w-full">
          {saving ? "Creating…" : "Create project"}
        </Button>
      </FieldGroup>
    </form>
  );
}
