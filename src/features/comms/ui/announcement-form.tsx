import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type AnnouncementLink = { value: string; label: string };
export type AnnouncementFormState = { title: string; body: string; link: string };

/** The "Send an announcement" panel on the Updates page. */
export function AnnouncementForm({
  form,
  onChange,
  onSubmit,
  pending,
  clientCount,
  links,
}: {
  form: AnnouncementFormState;
  onChange: (form: AnnouncementFormState) => void;
  onSubmit: () => void;
  pending: boolean;
  clientCount: number;
  links: AnnouncementLink[];
}) {
  return (
    <Card className="h-fit p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h2 className="mb-4 flex items-center gap-2 text-title-md">
          <Icon name="send" size={20} /> Send an announcement
        </h2>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nt-title">Title</FieldLabel>
            <Input
              id="nt-title"
              required
              maxLength={80}
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              placeholder="e.g. Water off on Thursday"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="nt-body">Message</FieldLabel>
            <Textarea id="nt-body" value={form.body} onChange={(e) => onChange({ ...form, body: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nt-link">Opens in the client app</FieldLabel>
            <NativeSelect id="nt-link" value={form.link} onChange={(e) => onChange({ ...form, link: e.target.value })}>
              {links.map((l) => (
                <NativeSelectOption key={l.value} value={l.value}>
                  {l.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={!form.title.trim() || pending || clientCount === 0} className="w-full">
            {clientCount === 0 ? "Invite a client first" : `Send to ${clientCount} client${clientCount > 1 ? "s" : ""}`}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}
